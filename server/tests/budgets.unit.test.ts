// Unit tests for Step 11 budget helpers and validation (no database access).
// Run with: npm run test:unit --workspace=server
import { deepStrictEqual, equal, ok } from "node:assert";
import { describe, it } from "node:test";
import { Prisma } from "@prisma/client";
import {
  budgetPercentage,
  budgetPeriod,
  budgetStatusFor,
  summarizeBudgets,
  toBudgetDto,
  type BudgetWithCategory,
  type BudgetWithSpending,
} from "../src/lib/budgets.js";
import {
  createBudgetSchema,
  listBudgetsQuerySchema,
  updateBudgetSchema,
} from "../src/schemas/budgets.js";

function decimal(value: string): Prisma.Decimal {
  return new Prisma.Decimal(value);
}

function budgetEntry(
  id: string,
  categoryId: string,
  categoryName: string,
  amount: string,
  spent: string,
): BudgetWithSpending {
  const budget: BudgetWithCategory = {
    id,
    userId: "user-1",
    categoryId,
    amount: decimal(amount),
    month: 10,
    year: 2026,
    createdAt: new Date("2026-10-01T00:00:00.000Z"),
    updatedAt: new Date("2026-10-01T00:00:00.000Z"),
    category: {
      id: categoryId,
      name: categoryName,
      type: "EXPENSE",
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
    },
  };
  return { budget, spent: decimal(spent) };
}

describe("budgetPeriod", () => {
  it("returns half-open UTC month ranges", () => {
    deepStrictEqual(budgetPeriod(10, 2026), {
      monthKey: "2026-10",
      start: new Date("2026-10-01T00:00:00.000Z"),
      end: new Date("2026-11-01T00:00:00.000Z"),
    });
    deepStrictEqual(budgetPeriod(2, 2024), {
      monthKey: "2024-02",
      start: new Date("2024-02-01T00:00:00.000Z"),
      end: new Date("2024-03-01T00:00:00.000Z"),
    });
  });

  it("rolls December into January of the next year", () => {
    deepStrictEqual(budgetPeriod(12, 2026), {
      monthKey: "2026-12",
      start: new Date("2026-12-01T00:00:00.000Z"),
      end: new Date("2027-01-01T00:00:00.000Z"),
    });
  });
});

describe("budgetPercentage and budgetStatusFor", () => {
  it("rounds percentages to two decimals and handles invalid limits", () => {
    equal(budgetPercentage(decimal("100.00"), decimal("90.00")), 90);
    equal(budgetPercentage(decimal("3.00"), decimal("1.00")), 33.33);
    equal(budgetPercentage(decimal("0.00"), decimal("10.00")), 0);
  });

  it("uses 80% approaching and 100% over thresholds", () => {
    equal(budgetStatusFor(decimal("100.00"), decimal("0.00")), "UNDER");
    equal(budgetStatusFor(decimal("100.00"), decimal("79.99")), "UNDER");
    equal(
      budgetStatusFor(decimal("100.00"), decimal("80.00")),
      "APPROACHING",
    );
    equal(
      budgetStatusFor(decimal("100.00"), decimal("99.99")),
      "APPROACHING",
    );
    equal(budgetStatusFor(decimal("100.00"), decimal("100.00")), "OVER");
    equal(budgetStatusFor(decimal("100.00"), decimal("125.00")), "OVER");
  });
});

describe("toBudgetDto", () => {
  it("serializes money, percentage, status, and category without user data", () => {
    const dto = toBudgetDto(
      budgetEntry("budget-1", "category-1", "Groceries", "100.00", "125.00"),
    );

    deepStrictEqual(dto, {
      id: "budget-1",
      categoryId: "category-1",
      amount: "100.00",
      month: 10,
      year: 2026,
      createdAt: new Date("2026-10-01T00:00:00.000Z"),
      updatedAt: new Date("2026-10-01T00:00:00.000Z"),
      category: {
        id: "category-1",
        name: "Groceries",
        type: "EXPENSE",
      },
      spent: "125.00",
      remaining: "-25.00",
      percentage: 125,
      status: "OVER",
    });
    equal("userId" in dto, false);
  });
});

describe("summarizeBudgets", () => {
  it("totals entries and counts every status", () => {
    const summary = summarizeBudgets(
      [
        budgetEntry("b1", "c1", "Dining Out", "100.00", "150.00"),
        budgetEntry("b2", "c2", "Groceries", "100.00", "90.00"),
        budgetEntry("b3", "c3", "Shopping", "100.00", "10.00"),
        budgetEntry("b4", "c4", "Utilities", "100.00", "0.00"),
      ],
      "2026-10",
    );

    deepStrictEqual(summary, {
      month: "2026-10",
      totalLimit: "400.00",
      totalSpent: "250.00",
      totalRemaining: "150.00",
      count: 4,
      underCount: 2,
      approachingCount: 1,
      overCount: 1,
    });
  });

  it("returns a zero summary for an empty period", () => {
    deepStrictEqual(summarizeBudgets([], "2026-10"), {
      month: "2026-10",
      totalLimit: "0.00",
      totalSpent: "0.00",
      totalRemaining: "0.00",
      count: 0,
      underCount: 0,
      approachingCount: 0,
      overCount: 0,
    });
  });
});

describe("budget schemas", () => {
  it("accepts valid create/list/update payloads", () => {
    const created = createBudgetSchema.safeParse({
      categoryId: "category-1",
      amount: "250.50",
      month: "10",
      year: "2026",
    });
    equal(created.success, true);
    if (created.success) {
      deepStrictEqual(created.data, {
        categoryId: "category-1",
        amount: "250.50",
        month: 10,
        year: 2026,
      });
    }

    equal(
      listBudgetsQuerySchema.safeParse({ month: "2", year: "2024" }).success,
      true,
    );
    equal(updateBudgetSchema.safeParse({ amount: "300" }).success, true);
  });

  it("rejects invalid periods, non-positive amounts, and empty updates", () => {
    const base = {
      categoryId: "category-1",
      amount: "100.00",
      month: 10,
      year: 2026,
    };
    equal(
      createBudgetSchema.safeParse({ ...base, amount: "0" }).success,
      false,
    );
    equal(
      createBudgetSchema.safeParse({ ...base, amount: "-1" }).success,
      false,
    );
    equal(
      createBudgetSchema.safeParse({ ...base, month: 13 }).success,
      false,
    );
    equal(
      createBudgetSchema.safeParse({ ...base, year: 1969 }).success,
      false,
    );
    equal(updateBudgetSchema.safeParse({}).success, false);
  });

  it("rejects unknown fields on budget mutations", () => {
    const parsed = createBudgetSchema.safeParse({
      categoryId: "category-1",
      amount: "100.00",
      month: 10,
      year: 2026,
      userId: "attacker",
    });
    equal(parsed.success, false);
    if (!parsed.success) {
      ok(parsed.error.issues.some((issue) => issue.code === "unrecognized_keys"));
    }
  });
});
