import { Router, type Request, type Response } from "express";
import { Prisma } from "@prisma/client";
import { asyncHandler } from "../middleware/asyncHandler";
import { requireAuth } from "../middleware/requireAuth";
import { loadBillSummary } from "../lib/bills";
import {
  loadBudgetsForPeriod,
  summarizeBudgets,
} from "../lib/budgets";
import { loadPotSummary } from "../lib/pots";
import { prisma } from "../lib/prisma";
import { buildMonthBuckets } from "../lib/monthRanges";

const router = Router();

// Every dashboard query is scoped to the authenticated JWT user.
router.use(requireAuth);

type MonthlyAggregateRow = {
  month: string;
  type: string;
  total: string;
};

type RecentTransaction = Prisma.TransactionGetPayload<{
  include: {
    account: { select: { id: true; name: true; type: true } };
    category: { select: { id: true; name: true; type: true } };
  };
}>;

type BreakdownRow = {
  categoryId: string | null;
  categoryName: string;
  amount: Prisma.Decimal;
};

function percentageOf(
  amount: Prisma.Decimal,
  total: Prisma.Decimal,
): number {
  if (total.isZero()) {
    return 0;
  }
  return Number(
    amount.div(total).mul(100).toDecimalPlaces(2).toString(),
  );
}

function toRecentTransactionDto(transaction: RecentTransaction) {
  return {
    id: transaction.id,
    accountId: transaction.accountId,
    categoryId: transaction.categoryId,
    amount: transaction.amount.toFixed(2),
    type: transaction.type,
    description: transaction.description,
    transactionDate: transaction.transactionDate,
    account: {
      id: transaction.account.id,
      name: transaction.account.name,
      type: transaction.account.type,
    },
    category: transaction.category
      ? {
          id: transaction.category.id,
          name: transaction.category.name,
          type: transaction.category.type,
        }
      : null,
  };
}

router.get(
  "/summary",
  asyncHandler(async (req: Request, res: Response): Promise<Response> => {
    const userId = req.userId ?? "";
    const now = new Date();
    const buckets = buildMonthBuckets(now, 6);
    const currentBucket = buckets[buckets.length - 1];
    const currentMonth = currentBucket.start.getUTCMonth() + 1;
    const currentYear = currentBucket.start.getUTCFullYear();

    const monthlyTotals = new Map<
      string,
      { income: Prisma.Decimal; expenses: Prisma.Decimal }
    >();
    for (const bucket of buckets) {
      monthlyTotals.set(bucket.month, {
        income: new Prisma.Decimal(0),
        expenses: new Prisma.Decimal(0),
      });
    }

    // Database-side grouping by calendar month keeps the overview efficient.
    // Prisma stores DateTime values as UTC in PostgreSQL timestamp columns,
    // so to_char() groups by the same UTC calendar boundaries used above.
    const [
      balanceAggregate,
      monthlyRows,
      expenseGroups,
      recent,
      currentBudgets,
      potSummary,
      billSummary,
    ] = await Promise.all([
        prisma.account.aggregate({
          where: { userId },
          _sum: { balance: true },
        }),
        prisma.$queryRaw<MonthlyAggregateRow[]>(
          Prisma.sql`
            SELECT
              to_char("transactionDate", 'YYYY-MM') AS "month",
              "type"::text AS "type",
              COALESCE(SUM("amount"), 0)::text AS "total"
            FROM "Transaction"
            WHERE "userId" = ${userId}
              AND "transactionDate" >= ${buckets[0].start}
              AND "transactionDate" < ${buckets[buckets.length - 1].end}
              AND "type"::text IN ('INCOME', 'EXPENSE')
            GROUP BY 1, 2
            ORDER BY 1 ASC
          `,
        ),
        prisma.transaction.groupBy({
          by: ["categoryId"],
          where: {
            userId,
            type: "EXPENSE",
            transactionDate: {
              gte: currentBucket.start,
              lt: currentBucket.end,
            },
          },
          _sum: { amount: true },
        }),
        prisma.transaction.findMany({
          where: { userId },
          orderBy: [
            { transactionDate: "desc" },
            { createdAt: "desc" },
            { id: "asc" },
          ],
          take: 5,
          include: {
            account: { select: { id: true, name: true, type: true } },
            category: { select: { id: true, name: true, type: true } },
          },
        }),
        loadBudgetsForPeriod(userId, currentMonth, currentYear),
        loadPotSummary(userId),
        loadBillSummary(userId, now),
      ]);

    for (const row of monthlyRows) {
      const totals = monthlyTotals.get(row.month);
      if (!totals) {
        continue;
      }
      const amount = new Prisma.Decimal(row.total);
      if (row.type === "INCOME") {
        totals.income = totals.income.add(amount);
      } else if (row.type === "EXPENSE") {
        totals.expenses = totals.expenses.add(amount);
      }
    }

    const currentTotals = monthlyTotals.get(currentBucket.month) ?? {
      income: new Prisma.Decimal(0),
      expenses: new Prisma.Decimal(0),
    };

    const categoryIds = expenseGroups
      .map((group) => group.categoryId)
      .filter((id): id is string => id !== null);

    // One batched lookup for all categories in the breakdown avoids N+1.
    const categories =
      categoryIds.length > 0
        ? await prisma.category.findMany({
            where: { id: { in: categoryIds } },
            select: { id: true, name: true },
          })
        : [];
    const categoryNames = new Map(
      categories.map((category) => [category.id, category.name]),
    );

    const breakdown = expenseGroups
      .map((group): BreakdownRow => {
        const categoryId = group.categoryId;
        return {
          categoryId,
          categoryName:
            categoryId === null
              ? "Uncategorized"
              : (categoryNames.get(categoryId) ?? "Unknown category"),
          amount: new Prisma.Decimal(group._sum.amount ?? 0),
        };
      })
      .sort((left, right) => {
        const byAmount = right.amount.comparedTo(left.amount);
        return byAmount !== 0
          ? byAmount
          : left.categoryName.localeCompare(right.categoryName);
      });

    const totalBalance = new Prisma.Decimal(
      balanceAggregate._sum.balance ?? 0,
    );

    return res.status(200).json({
      totalBalance: totalBalance.toFixed(2),
      totalIncome: currentTotals.income.toFixed(2),
      totalExpenses: currentTotals.expenses.toFixed(2),
      budgetSummary: summarizeBudgets(currentBudgets, currentBucket.month),
      potSummary,
      billSummary,
      monthlyOverview: buckets.map((bucket) => {
        const totals = monthlyTotals.get(bucket.month) ?? {
          income: new Prisma.Decimal(0),
          expenses: new Prisma.Decimal(0),
        };
        return {
          month: bucket.month,
          income: totals.income.toFixed(2),
          expenses: totals.expenses.toFixed(2),
        };
      }),
      expenseBreakdown: breakdown.map((row) => ({
        categoryId: row.categoryId,
        categoryName: row.categoryName,
        amount: row.amount.toFixed(2),
        percentage: percentageOf(row.amount, currentTotals.expenses),
      })),
      recentTransactions: recent.map(toRecentTransactionDto),
    });
  }),
);

export default router;
