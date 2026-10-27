import type {
  BudgetListResponse,
  BudgetMutationInput,
  BudgetPeriod,
  BudgetRecord,
  BudgetStatus,
  CategoryType,
} from "../types/api";
import { apiRequest } from "./client";
import {
  arrayField,
  asRecord,
  dateField,
  invalidResponse,
  moneyField,
  numberField,
  oneOf,
  stringField,
} from "./validation";

const BUDGET_STATUSES: readonly BudgetStatus[] = [
  "UNDER",
  "APPROACHING",
  "OVER",
];
const CATEGORY_TYPES: readonly CategoryType[] = ["INCOME", "EXPENSE"];

function parseBudgetPeriod(value: unknown): BudgetPeriod {
  const period = asRecord(value, "budget period");
  const month = numberField(period, "month", "budget month");
  const year = numberField(period, "year", "budget year");
  if (
    !Number.isInteger(month) ||
    month < 1 ||
    month > 12 ||
    !Number.isInteger(year) ||
    year < 1970
  ) {
    invalidResponse();
  }
  return { month, year };
}

function parseBudget(value: unknown): BudgetRecord {
  const budget = asRecord(value, "budget");
  const category = asRecord(budget.category, "budget category");
  const month = numberField(budget, "month", "budget month");
  const year = numberField(budget, "year", "budget year");
  const percentage = numberField(budget, "percentage", "budget percentage");
  if (
    !Number.isInteger(month) ||
    month < 1 ||
    month > 12 ||
    !Number.isInteger(year) ||
    year < 1970 ||
    percentage < 0
  ) {
    invalidResponse();
  }

  return {
    id: stringField(budget, "id", "budget id"),
    categoryId: stringField(budget, "categoryId", "budget category id"),
    amount: moneyField(budget, "amount", "budget amount"),
    month,
    year,
    category: {
      id: stringField(category, "id", "category id"),
      name: stringField(category, "name", "category name"),
      type: oneOf(category.type, CATEGORY_TYPES, "category type"),
    },
    spent: moneyField(budget, "spent", "budget spending"),
    remaining: moneyField(budget, "remaining", "budget remaining amount"),
    percentage,
    status: oneOf(budget.status, BUDGET_STATUSES, "budget status"),
    createdAt: dateField(budget, "createdAt", "budget creation date"),
    updatedAt: dateField(budget, "updatedAt", "budget update date"),
  };
}

function parseBudgetResponse(value: unknown): BudgetRecord {
  const response = asRecord(value, "budget response");
  return parseBudget(response.budget);
}

export async function fetchBudgets(
  token: string,
  period: BudgetPeriod,
  signal?: AbortSignal,
): Promise<BudgetListResponse> {
  const params = new URLSearchParams({
    month: String(period.month),
    year: String(period.year),
  });
  const payload = await apiRequest<unknown>(`/api/budgets?${params}`, {
    token,
    signal,
  });
  const response = asRecord(payload, "budget list response");
  return {
    period: parseBudgetPeriod(response.period),
    budgets: arrayField(response, "budgets", "budgets").map(parseBudget),
  };
}

export async function createBudget(
  token: string,
  input: BudgetMutationInput,
): Promise<BudgetRecord> {
  const payload = await apiRequest<unknown>("/api/budgets", {
    method: "POST",
    token,
    body: input,
  });
  return parseBudgetResponse(payload);
}

export async function updateBudget(
  token: string,
  id: string,
  input: BudgetMutationInput,
): Promise<BudgetRecord> {
  const payload = await apiRequest<unknown>(
    `/api/budgets/${encodeURIComponent(id)}`,
    {
      method: "PATCH",
      token,
      body: input,
    },
  );
  return parseBudgetResponse(payload);
}

export async function deleteBudget(
  token: string,
  id: string,
): Promise<void> {
  await apiRequest<unknown>(`/api/budgets/${encodeURIComponent(id)}`, {
    method: "DELETE",
    token,
  });
}
