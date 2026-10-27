import type {
  BudgetMutationInput,
  BudgetPeriod,
  BudgetRecord,
  BudgetStatus,
  Category,
} from "../types/api";
import { formatMonthLong, toFiniteAmount } from "./format";

const MONEY_PATTERN = /^\d+(\.\d{1,2})?$/;
const MAX_AMOUNT = 9_999_999_999.99;
const APPROACHING_THRESHOLD = 80;

export const BUDGET_STATUS_LABELS: Record<BudgetStatus, string> = {
  UNDER: "Under budget",
  APPROACHING: "Approaching limit",
  OVER: "Over budget",
};

export interface BudgetFormValues {
  categoryId: string;
  amount: string;
}

export type BudgetFormErrors = Partial<
  Record<keyof BudgetFormValues, string>
>;

export function currentUtcBudgetPeriod(): BudgetPeriod {
  const now = new Date();
  return {
    month: now.getUTCMonth() + 1,
    year: now.getUTCFullYear(),
  };
}

export function shiftBudgetPeriod(
  period: BudgetPeriod,
  months: number,
): BudgetPeriod {
  const shifted = new Date(
    Date.UTC(period.year, period.month - 1 + months, 1),
  );
  return {
    month: shifted.getUTCMonth() + 1,
    year: shifted.getUTCFullYear(),
  };
}

export function budgetPeriodKey(period: BudgetPeriod): string {
  return `${period.year}-${String(period.month).padStart(2, "0")}`;
}

export function budgetPeriodLabel(period: BudgetPeriod): string {
  return formatMonthLong(budgetPeriodKey(period));
}

export function emptyBudgetForm(categoryId = ""): BudgetFormValues {
  return { categoryId, amount: "" };
}

export function formValuesFromBudget(budget: BudgetRecord): BudgetFormValues {
  return { categoryId: budget.categoryId, amount: budget.amount };
}

export function validateBudgetForm(
  values: BudgetFormValues,
  categories: Category[],
): BudgetFormErrors {
  const errors: BudgetFormErrors = {};
  const amountText = values.amount.trim();
  const category = categories.find(
    (candidate) => candidate.id === values.categoryId,
  );

  if (!values.categoryId) {
    errors.categoryId = "Choose an expense category.";
  } else if (!category) {
    errors.categoryId = "That category is no longer available.";
  } else if (category.type !== "EXPENSE") {
    errors.categoryId = "Budgets can only use expense categories.";
  }

  if (!amountText) {
    errors.amount = "Enter a monthly limit.";
  } else if (!MONEY_PATTERN.test(amountText)) {
    errors.amount = "Use a positive number with at most two decimal places.";
  } else {
    const amount = Number(amountText);
    if (!Number.isFinite(amount) || amount <= 0) {
      errors.amount = "Monthly limit must be greater than zero.";
    } else if (amount > MAX_AMOUNT) {
      errors.amount = "Monthly limit is out of range.";
    }
  }

  return errors;
}

export function toBudgetMutationInput(
  values: BudgetFormValues,
  period: BudgetPeriod,
): BudgetMutationInput {
  return {
    categoryId: values.categoryId,
    amount: values.amount.trim(),
    month: period.month,
    year: period.year,
  };
}

export function budgetStatusForAmounts(
  limit: string | number,
  spent: string | number,
): BudgetStatus {
  const limitValue = toFiniteAmount(limit);
  const spentValue = toFiniteAmount(spent);
  if (limitValue <= 0) {
    return "UNDER";
  }
  if (spentValue >= limitValue) {
    return "OVER";
  }
  return (spentValue / limitValue) * 100 >= APPROACHING_THRESHOLD
    ? "APPROACHING"
    : "UNDER";
}

export function budgetProgressWidth(percentage: number): number {
  if (!Number.isFinite(percentage)) {
    return 0;
  }
  return Math.min(100, Math.max(0, percentage));
}
