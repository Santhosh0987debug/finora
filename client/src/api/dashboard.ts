import type {
  AccountType,
  CategoryType,
  DashboardBudgetSummary,
  DashboardPotSummary,
  DashboardSummary,
  ExpenseBreakdownItem,
  MonthlyOverviewPoint,
  RecentTransaction,
  SummaryAccount,
  SummaryCategory,
  TransactionType,
} from "../types/api";
import { parseBillSummary } from "./bills";
import { apiRequest } from "./client";
import {
  arrayField,
  asRecord,
  dateField,
  invalidResponse,
  moneyField,
  nullableStringField,
  numberField,
  oneOf,
  stringField,
} from "./validation";

const ACCOUNT_TYPES: readonly AccountType[] = [
  "CHECKING",
  "SAVINGS",
  "CREDIT_CARD",
];
const CATEGORY_TYPES: readonly CategoryType[] = ["INCOME", "EXPENSE"];
const TRANSACTION_TYPES: readonly TransactionType[] = [
  "INCOME",
  "EXPENSE",
  "TRANSFER",
];
const MONTH_PATTERN = /^\d{4}-(0[1-9]|1[0-2])$/;

function parseAccount(value: unknown): SummaryAccount {
  const account = asRecord(value, "transaction account");
  return {
    id: stringField(account, "id", "account id"),
    name: stringField(account, "name", "account name"),
    type: oneOf(account.type, ACCOUNT_TYPES, "account type"),
  };
}

function parseCategory(value: unknown): SummaryCategory {
  const category = asRecord(value, "transaction category");
  return {
    id: stringField(category, "id", "category id"),
    name: stringField(category, "name", "category name"),
    type: oneOf(category.type, CATEGORY_TYPES, "category type"),
  };
}

function parseMonthlyPoint(value: unknown): MonthlyOverviewPoint {
  const point = asRecord(value, "monthly overview entry");
  const month = stringField(point, "month", "overview month");
  if (!MONTH_PATTERN.test(month)) {
    invalidResponse();
  }
  return {
    month,
    income: moneyField(point, "income", "monthly income"),
    expenses: moneyField(point, "expenses", "monthly expenses"),
  };
}

function parseBreakdownItem(value: unknown): ExpenseBreakdownItem {
  const item = asRecord(value, "expense breakdown entry");
  return {
    categoryId: nullableStringField(item, "categoryId", "category id"),
    categoryName: stringField(item, "categoryName", "category name"),
    amount: moneyField(item, "amount", "category amount"),
    percentage: numberField(item, "percentage", "category percentage"),
  };
}

function parseBudgetSummary(value: unknown): DashboardBudgetSummary {
  const summary = asRecord(value, "budget summary");
  const month = stringField(summary, "month", "budget summary month");
  if (!MONTH_PATTERN.test(month)) {
    invalidResponse();
  }

  const underCount = numberField(summary, "underCount", "under-budget count");
  const approachingCount = numberField(
    summary,
    "approachingCount",
    "approaching-limit count",
  );
  const overCount = numberField(summary, "overCount", "over-budget count");
  const count = numberField(summary, "count", "budget count");
  if (
    !Number.isInteger(underCount) ||
    !Number.isInteger(approachingCount) ||
    !Number.isInteger(overCount) ||
    !Number.isInteger(count) ||
    underCount < 0 ||
    approachingCount < 0 ||
    overCount < 0 ||
    count < 0 ||
    underCount + approachingCount + overCount !== count
  ) {
    invalidResponse();
  }

  return {
    month,
    totalLimit: moneyField(summary, "totalLimit", "total budget limit"),
    totalSpent: moneyField(summary, "totalSpent", "total budget spending"),
    totalRemaining: moneyField(
      summary,
      "totalRemaining",
      "total budget remaining",
    ),
    count,
    underCount,
    approachingCount,
    overCount,
  };
}

function parsePotSummary(value: unknown): DashboardPotSummary {
  const summary = asRecord(value, "savings pot summary");
  const count = numberField(summary, "count", "savings pot count");
  const completedCount = numberField(
    summary,
    "completedCount",
    "completed savings pot count",
  );
  const percentage = numberField(
    summary,
    "percentage",
    "savings pot progress",
  );
  if (
    !Number.isInteger(count) ||
    !Number.isInteger(completedCount) ||
    count < 0 ||
    completedCount < 0 ||
    completedCount > count ||
    percentage < 0
  ) {
    invalidResponse();
  }

  return {
    count,
    totalSaved: moneyField(summary, "totalSaved", "total pot savings"),
    totalTarget: moneyField(summary, "totalTarget", "total pot targets"),
    totalRemaining: moneyField(
      summary,
      "totalRemaining",
      "total pot remaining",
    ),
    completedCount,
    percentage,
  };
}

function parseRecentTransaction(value: unknown): RecentTransaction {
  const transaction = asRecord(value, "recent transaction");
  const categoryValue = transaction.category;
  return {
    id: stringField(transaction, "id", "transaction id"),
    accountId: stringField(transaction, "accountId", "account id"),
    categoryId: nullableStringField(transaction, "categoryId", "category id"),
    amount: moneyField(transaction, "amount", "transaction amount"),
    type: oneOf(transaction.type, TRANSACTION_TYPES, "transaction type"),
    description: nullableStringField(
      transaction,
      "description",
      "transaction description",
    ),
    transactionDate: dateField(
      transaction,
      "transactionDate",
      "transaction date",
    ),
    account: parseAccount(transaction.account),
    category: categoryValue == null ? null : parseCategory(categoryValue),
  };
}

function parseDashboardSummary(value: unknown): DashboardSummary {
  const summary = asRecord(value, "dashboard summary");
  const monthlyOverview = arrayField(
    summary,
    "monthlyOverview",
    "monthly overview",
  ).map(parseMonthlyPoint);
  if (monthlyOverview.length !== 6) {
    invalidResponse();
  }

  return {
    totalBalance: moneyField(summary, "totalBalance", "total balance"),
    totalIncome: moneyField(summary, "totalIncome", "monthly income"),
    totalExpenses: moneyField(summary, "totalExpenses", "monthly expenses"),
    budgetSummary: parseBudgetSummary(summary.budgetSummary),
    potSummary: parsePotSummary(summary.potSummary),
    billSummary: parseBillSummary(summary.billSummary),
    monthlyOverview,
    expenseBreakdown: arrayField(
      summary,
      "expenseBreakdown",
      "expense breakdown",
    ).map(parseBreakdownItem),
    recentTransactions: arrayField(
      summary,
      "recentTransactions",
      "recent transactions",
    ).map(parseRecentTransaction),
  };
}

export async function fetchDashboardSummary(
  token: string,
  signal?: AbortSignal,
): Promise<DashboardSummary> {
  const payload = await apiRequest<unknown>("/api/dashboard/summary", {
    token,
    signal,
  });
  return parseDashboardSummary(payload);
}
