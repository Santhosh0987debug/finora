import { Router, type Request, type Response } from "express";
import {
  Prisma,
  type AccountType,
  type Transaction,
  type TransactionType,
} from "@prisma/client";
import { asyncHandler } from "../middleware/asyncHandler";
import { requireAuth } from "../middleware/requireAuth";
import { prisma } from "../lib/prisma";
import {
  createTransactionSchema,
  listTransactionsQuerySchema,
  updateTransactionSchema,
} from "../schemas/transactions";

const router = Router();

// Authentication is required for every transaction endpoint; userId always
// comes from the verified JWT and never from the body or query string.
router.use(requireAuth);

const TRANSACTION_TX_OPTIONS = {
  // Row-level locks (SELECT ... FOR UPDATE) serialize balance changes. Read
  // committed is sufficient because every account row read for a write is
  // locked for the remainder of the transaction.
  isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted,
  maxWait: 10_000,
  timeout: 20_000,
} as const;

class ApiError extends Error {
  constructor(
    readonly statusCode: number,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

type LockedAccount = {
  id: string;
  balance: Prisma.Decimal;
  type: AccountType;
};

function sendApiError(res: Response, error: unknown): boolean {
  if (error instanceof ApiError) {
    res.status(error.statusCode).json({ error: error.message });
    return true;
  }
  return false;
}

function validationError(res: Response, issues: { message: string }[]): Response {
  return res
    .status(400)
    .json({ error: issues[0]?.message ?? "Invalid request" });
}

// Amounts are serialized as exact two-decimal strings, matching the accounts
// API. Only the transaction's own fields are returned.
function toTransactionDto(transaction: Transaction) {
  return {
    id: transaction.id,
    userId: transaction.userId,
    accountId: transaction.accountId,
    categoryId: transaction.categoryId,
    amount: transaction.amount.toFixed(2),
    type: transaction.type,
    description: transaction.description,
    transactionDate: transaction.transactionDate,
    createdAt: transaction.createdAt,
    updatedAt: transaction.updatedAt,
  };
}

// Locks the requested accounts in a deterministic order (id ascending) so
// concurrent requests cannot deadlock while updating opposite accounts.
async function lockAccounts(
  tx: Prisma.TransactionClient,
  userId: string,
  accountIds: string[],
): Promise<Map<string, LockedAccount>> {
  const uniqueIds = [...new Set(accountIds)].sort();
  if (uniqueIds.length === 0) {
    return new Map();
  }

  const rows = await tx.$queryRaw<LockedAccount[]>(
    Prisma.sql`
      SELECT "id", "balance", "type"
      FROM "Account"
      WHERE "userId" = ${userId}
        AND "id" IN (${Prisma.join(uniqueIds)})
      ORDER BY "id" ASC
      FOR UPDATE
    `,
  );

  return new Map(
    rows.map((row) => [
      row.id,
      { ...row, balance: new Prisma.Decimal(row.balance) },
    ]),
  );
}

// Locks a transaction row before reading it so concurrent update/delete
// requests for the same transaction are serialized.
async function lockOwnedTransaction(
  tx: Prisma.TransactionClient,
  userId: string,
  id: string,
): Promise<Transaction> {
  const rows = await tx.$queryRaw<Array<{ id: string }>>(
    Prisma.sql`
      SELECT "id"
      FROM "Transaction"
      WHERE "id" = ${id}
        AND "userId" = ${userId}
      FOR UPDATE
    `,
  );

  if (rows.length === 0) {
    throw new ApiError(404, "Transaction not found");
  }

  const transaction = await tx.transaction.findFirst({
    where: { id, userId },
  });
  if (!transaction) {
    throw new ApiError(404, "Transaction not found");
  }
  return transaction;
}

// Categories are global reference data in the Prisma schema (no userId), so
// ownership is not applicable. Existence and type compatibility are enforced.
async function resolveCategory(
  tx: Prisma.TransactionClient,
  categoryId: string | null,
  type: TransactionType,
): Promise<string | null> {
  if (categoryId === null) {
    return null;
  }

  if (type === "TRANSFER") {
    throw new ApiError(400, "Transfer transactions are not supported");
  }

  const category = await tx.category.findUnique({ where: { id: categoryId } });
  if (!category) {
    throw new ApiError(400, "Category not found");
  }

  if (category.type !== type) {
    throw new ApiError(
      400,
      `Category type must match transaction type (${type})`,
    );
  }

  return category.id;
}

// Signed effect of a transaction on its account balance.
function effectFor(
  type: TransactionType,
  amount: Prisma.Decimal,
): Prisma.Decimal {
  if (type === "INCOME") {
    return amount;
  }
  if (type === "EXPENSE") {
    return amount.negated();
  }
  throw new ApiError(400, "Transfer transactions are not supported");
}

// Checking and savings accounts may not be overdrawn by a transaction
// operation. Credit cards may carry a negative balance (debt). A no-op or
// balance-improving update is allowed even if the account is already negative.
function assertNoOverdraft(
  account: LockedAccount,
  projectedBalance: Prisma.Decimal,
  netChange: Prisma.Decimal,
): void {
  if (
    account.type !== "CREDIT_CARD" &&
    netChange.isNegative() &&
    projectedBalance.isNegative()
  ) {
    throw new ApiError(409, "Insufficient funds");
  }
}

router.get(
  "/",
  asyncHandler(async (req: Request, res: Response): Promise<Response> => {
    const parsed = listTransactionsQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      return validationError(res, parsed.error.issues);
    }

    const userId = req.userId ?? "";
    const page = parsed.data.page ?? 1;
    const limit = parsed.data.limit ?? 20;
    const skip = (page - 1) * limit;

    // A foreign account id is indistinguishable from a nonexistent one.
    if (parsed.data.accountId !== undefined) {
      const account = await prisma.account.findFirst({
        where: { id: parsed.data.accountId, userId },
        select: { id: true },
      });
      if (!account) {
        return res.status(404).json({ error: "Account not found" });
      }
    }

    const transactionDate =
      parsed.data.from !== undefined || parsed.data.to !== undefined
        ? {
            ...(parsed.data.from !== undefined
              ? { gte: parsed.data.from }
              : {}),
            ...(parsed.data.to !== undefined ? { lte: parsed.data.to } : {}),
          }
        : undefined;

    const where: Prisma.TransactionWhereInput = {
      userId,
      ...(parsed.data.accountId !== undefined
        ? { accountId: parsed.data.accountId }
        : {}),
      ...(parsed.data.categoryId !== undefined
        ? { categoryId: parsed.data.categoryId }
        : {}),
      ...(parsed.data.type !== undefined ? { type: parsed.data.type } : {}),
      ...(transactionDate !== undefined ? { transactionDate } : {}),
    };

    const [total, transactions] = await prisma.$transaction([
      prisma.transaction.count({ where }),
      prisma.transaction.findMany({
        where,
        orderBy: [
          { transactionDate: "desc" },
          { createdAt: "desc" },
          { id: "asc" },
        ],
        skip,
        take: limit,
      }),
    ]);

    const totalPages = total === 0 ? 0 : Math.ceil(total / limit);

    return res.status(200).json({
      transactions: transactions.map(toTransactionDto),
      pagination: {
        page,
        limit,
        total,
        totalPages,
        hasNext: skip + transactions.length < total,
        hasPrevious: page > 1,
      },
    });
  }),
);

router.get(
  "/:id",
  asyncHandler(async (req: Request, res: Response): Promise<Response> => {
    const transaction = await prisma.transaction.findFirst({
      where: { id: req.params.id, userId: req.userId ?? "" },
    });
    if (!transaction) {
      return res.status(404).json({ error: "Transaction not found" });
    }
    return res.status(200).json({ transaction: toTransactionDto(transaction) });
  }),
);

router.post(
  "/",
  asyncHandler(async (req: Request, res: Response): Promise<Response> => {
    const parsed = createTransactionSchema.safeParse(req.body);
    if (!parsed.success) {
      return validationError(res, parsed.error.issues);
    }

    const userId = req.userId ?? "";
    const { accountId, type } = parsed.data;
    const amount = new Prisma.Decimal(parsed.data.amount);

    try {
      const transaction = await prisma.$transaction(async (tx) => {
        const accounts = await lockAccounts(tx, userId, [accountId]);
        const account = accounts.get(accountId);
        if (!account) {
          throw new ApiError(404, "Account not found");
        }

        const categoryId = await resolveCategory(
          tx,
          parsed.data.categoryId ?? null,
          type,
        );

        const effect = effectFor(type, amount);
        const projectedBalance = account.balance.add(effect);
        assertNoOverdraft(account, projectedBalance, effect);

        const created = await tx.transaction.create({
          data: {
            userId,
            accountId,
            categoryId,
            amount,
            type,
            ...(parsed.data.description !== undefined
              ? { description: parsed.data.description }
              : {}),
            ...(parsed.data.transactionDate !== undefined
              ? { transactionDate: parsed.data.transactionDate }
              : {}),
          },
        });

        if (!effect.isZero()) {
          await tx.account.update({
            where: { id: accountId },
            data: { balance: { increment: effect } },
          });
        }

        return created;
      }, TRANSACTION_TX_OPTIONS);

      return res
        .status(201)
        .json({ transaction: toTransactionDto(transaction) });
    } catch (error) {
      if (sendApiError(res, error)) {
        return res;
      }
      throw error;
    }
  }),
);

router.patch(
  "/:id",
  asyncHandler(async (req: Request, res: Response): Promise<Response> => {
    const parsed = updateTransactionSchema.safeParse(req.body);
    if (!parsed.success) {
      return validationError(res, parsed.error.issues);
    }

    const userId = req.userId ?? "";

    try {
      const updated = await prisma.$transaction(async (tx) => {
        const existing = await lockOwnedTransaction(
          tx,
          userId,
          req.params.id,
        );

        const effectiveType = parsed.data.type ?? existing.type;
        if (effectiveType === "TRANSFER") {
          throw new ApiError(400, "Transfer transactions are not supported");
        }

        const newAccountId = parsed.data.accountId ?? existing.accountId;
        const accounts = await lockAccounts(tx, userId, [
          existing.accountId,
          newAccountId,
        ]);
        const oldAccount = accounts.get(existing.accountId);
        if (!oldAccount) {
          throw new ApiError(409, "Transaction account no longer exists");
        }
        const newAccount = accounts.get(newAccountId);
        if (!newAccount) {
          throw new ApiError(404, "Account not found");
        }

        const amount =
          parsed.data.amount !== undefined
            ? new Prisma.Decimal(parsed.data.amount)
            : existing.amount;
        const categoryId =
          parsed.data.categoryId !== undefined
            ? parsed.data.categoryId
            : existing.categoryId;
        const resolvedCategoryId = await resolveCategory(
          tx,
          categoryId,
          effectiveType,
        );

        const oldEffect = effectFor(existing.type, existing.amount);
        const newEffect = effectFor(effectiveType, amount);
        const sameAccount = newAccountId === existing.accountId;

        if (sameAccount) {
          const netChange = newEffect.sub(oldEffect);
          const projectedBalance = newAccount.balance.add(netChange);
          assertNoOverdraft(newAccount, projectedBalance, netChange);

          if (!netChange.isZero()) {
            await tx.account.update({
              where: { id: newAccountId },
              data: { balance: { increment: netChange } },
            });
          }
        } else {
          const oldReversal = oldEffect.negated();
          const oldProjectedBalance = oldAccount.balance.add(oldReversal);
          assertNoOverdraft(oldAccount, oldProjectedBalance, oldReversal);

          const newProjectedBalance = newAccount.balance.add(newEffect);
          assertNoOverdraft(newAccount, newProjectedBalance, newEffect);

          if (!oldReversal.isZero()) {
            await tx.account.update({
              where: { id: oldAccount.id },
              data: { balance: { increment: oldReversal } },
            });
          }
          if (!newEffect.isZero()) {
            await tx.account.update({
              where: { id: newAccount.id },
              data: { balance: { increment: newEffect } },
            });
          }
        }

        const data: Prisma.TransactionUncheckedUpdateInput = {
          accountId: newAccountId,
          categoryId: resolvedCategoryId,
          amount,
          type: effectiveType,
          ...(parsed.data.description !== undefined
            ? { description: parsed.data.description }
            : {}),
          ...(parsed.data.transactionDate !== undefined
            ? { transactionDate: parsed.data.transactionDate }
            : {}),
        };

        return tx.transaction.update({
          where: { id: existing.id },
          data,
        });
      }, TRANSACTION_TX_OPTIONS);

      return res.status(200).json({ transaction: toTransactionDto(updated) });
    } catch (error) {
      if (sendApiError(res, error)) {
        return res;
      }
      throw error;
    }
  }),
);

router.delete(
  "/:id",
  asyncHandler(async (req: Request, res: Response): Promise<Response> => {
    const userId = req.userId ?? "";

    try {
      await prisma.$transaction(async (tx) => {
        const existing = await lockOwnedTransaction(
          tx,
          userId,
          req.params.id,
        );

        const accounts = await lockAccounts(tx, userId, [existing.accountId]);
        const account = accounts.get(existing.accountId);
        if (!account) {
          throw new ApiError(409, "Transaction account no longer exists");
        }

        const effect = effectFor(existing.type, existing.amount);
        const reversal = effect.negated();
        const projectedBalance = account.balance.add(reversal);
        assertNoOverdraft(account, projectedBalance, reversal);

        if (!reversal.isZero()) {
          await tx.account.update({
            where: { id: account.id },
            data: { balance: { increment: reversal } },
          });
        }

        await tx.transaction.delete({ where: { id: existing.id } });
      }, TRANSACTION_TX_OPTIONS);

      return res.status(204).send();
    } catch (error) {
      if (sendApiError(res, error)) {
        return res;
      }
      throw error;
    }
  }),
);

export default router;
