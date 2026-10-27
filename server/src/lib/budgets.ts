import { Prisma } from "@prisma/client";
import { prisma } from "./prisma";
import { addUtcMonths, startOfUtcMonth, utcMonthKey } from "./monthRanges";

export type BudgetStatus = "UNDER" | "APPROACHING" | "OVER";

const APPROACHING_THRESHOLD = 80;

export type BudgetWithCategory = Prisma.BudgetGetPayload<{
  include: { category: true };
}>;

export type BudgetWithSpending = {
  budget: BudgetWithCategory;
  spent: Prisma.Decimal;
};

export type BudgetSummary = {
  month: string;
  totalLimit: string;
  totalSpent: string;
  totalRemaining: string;
  count: number;
  underCount: number;
  approachingCount: number;
  overCount: number;
};

export function budgetPeriod(
  month: number,
  year: number,
): { monthKey: string; start: Date; end: Date } {
  const start = startOfUtcMonth(new Date(Date.UTC(year, month - 1, 1)));
  return {
    monthKey: utcMonthKey(start),
    start,
    end: addUtcMonths(start, 1),
  };
}

export function budgetPercentage(
  amount: Prisma.Decimal,
  spent: Prisma.Decimal,
): number {
  if (amount.lessThanOrEqualTo(0)) {
    return 0;
  }
  return Number(
    spent.div(amount).mul(100).toDecimalPlaces(2).toString(),
  );
}

// At exactly 100% the budget is treated as over/at-limit so the UI uses the
// strongest warning state. Approaching starts at 80%.
export function budgetStatusFor(
  amount: Prisma.Decimal,
  spent: Prisma.Decimal,
): BudgetStatus {
  if (spent.greaterThanOrEqualTo(amount)) {
    return "OVER";
  }
  if (budgetPercentage(amount, spent) >= APPROACHING_THRESHOLD) {
    return "APPROACHING";
  }
  return "UNDER";
}

export function toBudgetDto({ budget, spent }: BudgetWithSpending) {
  const remaining = budget.amount.sub(spent);
  return {
    id: budget.id,
    categoryId: budget.categoryId,
    amount: budget.amount.toFixed(2),
    month: budget.month,
    year: budget.year,
    createdAt: budget.createdAt,
    updatedAt: budget.updatedAt,
    category: {
      id: budget.category.id,
      name: budget.category.name,
      type: budget.category.type,
    },
    spent: spent.toFixed(2),
    remaining: remaining.toFixed(2),
    percentage: budgetPercentage(budget.amount, spent),
    status: budgetStatusFor(budget.amount, spent),
  };
}

export async function loadBudgetsForPeriod(
  userId: string,
  month: number,
  year: number,
): Promise<BudgetWithSpending[]> {
  const budgets = await prisma.budget.findMany({
    where: { userId, month, year },
    include: { category: true },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
  });

  if (budgets.length === 0) {
    return [];
  }

  const { start, end } = budgetPeriod(month, year);
  const categoryIds = budgets.map((budget) => budget.categoryId);
  const spendingGroups = await prisma.transaction.groupBy({
    by: ["categoryId"],
    where: {
      userId,
      type: "EXPENSE",
      categoryId: { in: categoryIds },
      transactionDate: { gte: start, lt: end },
    },
    _sum: { amount: true },
  });

  const spentByCategory = new Map(
    spendingGroups.map((group) => [
      group.categoryId,
      new Prisma.Decimal(group._sum.amount ?? 0),
    ]),
  );

  return budgets
    .map((budget) => ({
      budget,
      spent: spentByCategory.get(budget.categoryId) ?? new Prisma.Decimal(0),
    }))
    .sort((left, right) =>
      left.budget.category.name.localeCompare(right.budget.category.name),
    );
}

export async function spendingForBudget(
  userId: string,
  budget: BudgetWithCategory,
): Promise<Prisma.Decimal> {
  const { start, end } = budgetPeriod(budget.month, budget.year);
  const aggregate = await prisma.transaction.aggregate({
    where: {
      userId,
      type: "EXPENSE",
      categoryId: budget.categoryId,
      transactionDate: { gte: start, lt: end },
    },
    _sum: { amount: true },
  });
  return new Prisma.Decimal(aggregate._sum.amount ?? 0);
}

export function summarizeBudgets(
  entries: BudgetWithSpending[],
  monthKey: string,
): BudgetSummary {
  let totalLimit = new Prisma.Decimal(0);
  let totalSpent = new Prisma.Decimal(0);
  let underCount = 0;
  let approachingCount = 0;
  let overCount = 0;

  for (const { budget, spent } of entries) {
    totalLimit = totalLimit.add(budget.amount);
    totalSpent = totalSpent.add(spent);
    const status = budgetStatusFor(budget.amount, spent);
    if (status === "OVER") {
      overCount += 1;
    } else if (status === "APPROACHING") {
      approachingCount += 1;
    } else {
      underCount += 1;
    }
  }

  return {
    month: monthKey,
    totalLimit: totalLimit.toFixed(2),
    totalSpent: totalSpent.toFixed(2),
    totalRemaining: totalLimit.sub(totalSpent).toFixed(2),
    count: entries.length,
    underCount,
    approachingCount,
    overCount,
  };
}
