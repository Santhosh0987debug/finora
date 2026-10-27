import { Router, type Request, type Response } from "express";
import { Prisma, type Account } from "@prisma/client";
import { asyncHandler } from "../middleware/asyncHandler";
import { requireAuth } from "../middleware/requireAuth";
import { prisma } from "../lib/prisma";
import { createAccountSchema, updateAccountSchema } from "../schemas/accounts";

const router = Router();

// All account endpoints require authentication; userId always comes from
// the verified JWT (req.userId), never from the request body or query.
router.use(requireAuth);

// Account DTO: balance is serialized as an exact two-decimal string
// (Decimal.js arithmetic only — never binary floating point).
// Only the account's own fields are returned — never user data or secrets.
function toAccountDto(account: Account) {
  return {
    id: account.id,
    userId: account.userId,
    name: account.name,
    type: account.type,
    balance: account.balance.toFixed(2),
    currency: account.currency,
    createdAt: account.createdAt,
    updatedAt: account.updatedAt,
  };
}

function validationError(res: Response, issues: { message: string }[]): Response {
  return res
    .status(400)
    .json({ error: issues[0]?.message ?? "Invalid request" });
}

// Ownership is enforced inside the query (id + userId) so another user's
// account is indistinguishable from a nonexistent one: always 404.
async function findOwnedAccount(id: string, userId: string) {
  return prisma.account.findFirst({ where: { id, userId } });
}

router.get(
  "/",
  asyncHandler(async (req: Request, res: Response): Promise<Response> => {
    const accounts = await prisma.account.findMany({
      where: { userId: req.userId ?? "" },
      orderBy: [{ createdAt: "desc" }, { id: "asc" }],
    });
    return res.status(200).json({ accounts: accounts.map(toAccountDto) });
  }),
);

router.post(
  "/",
  asyncHandler(async (req: Request, res: Response): Promise<Response> => {
    const parsed = createAccountSchema.safeParse(req.body);
    if (!parsed.success) {
      return validationError(res, parsed.error.issues);
    }
    const { name, type, balance, currency } = parsed.data;
    const account = await prisma.account.create({
      data: {
        // Omitted balance/currency fall through to the Prisma schema
        // defaults (0 and "USD") — never invented here.
        ...(balance !== undefined ? { balance } : {}),
        ...(currency !== undefined ? { currency } : {}),
        name,
        type,
        user: { connect: { id: req.userId ?? "" } },
      },
    });
    return res.status(201).json({ account: toAccountDto(account) });
  }),
);

router.get(
  "/:id",
  asyncHandler(async (req: Request, res: Response): Promise<Response> => {
    const account = await findOwnedAccount(req.params.id, req.userId ?? "");
    if (!account) {
      return res.status(404).json({ error: "Account not found" });
    }
    return res.status(200).json({ account: toAccountDto(account) });
  }),
);

router.patch(
  "/:id",
  asyncHandler(async (req: Request, res: Response): Promise<Response> => {
    const parsed = updateAccountSchema.safeParse(req.body);
    if (!parsed.success) {
      return validationError(res, parsed.error.issues);
    }
    const account = await findOwnedAccount(req.params.id, req.userId ?? "");
    if (!account) {
      return res.status(404).json({ error: "Account not found" });
    }
    // Only whitelisted fields reach the update — id/userId cannot change.
    const { name, type, balance, currency } = parsed.data;
    const updated = await prisma.account.update({
      where: { id: account.id },
      data: {
        ...(name !== undefined ? { name } : {}),
        ...(type !== undefined ? { type } : {}),
        ...(balance !== undefined ? { balance } : {}),
        ...(currency !== undefined ? { currency } : {}),
      },
    });
    return res.status(200).json({ account: toAccountDto(updated) });
  }),
);

router.delete(
  "/:id",
  asyncHandler(async (req: Request, res: Response): Promise<Response> => {
    const account = await findOwnedAccount(req.params.id, req.userId ?? "");
    if (!account) {
      return res.status(404).json({ error: "Account not found" });
    }
    // The schema cascades transactions when an account is deleted, so
    // deletion is refused while transactions reference the account to
    // prevent accidental loss of financial history.
    const transactionCount = await prisma.transaction.count({
      where: { accountId: account.id },
    });
    if (transactionCount > 0) {
      return res
        .status(409)
        .json({ error: "Cannot delete account with existing transactions" });
    }
    try {
      await prisma.account.delete({ where: { id: account.id } });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2003"
      ) {
        return res
          .status(409)
          .json({ error: "Cannot delete account with existing transactions" });
      }
      throw error;
    }
    return res.status(204).send();
  }),
);

export default router;
