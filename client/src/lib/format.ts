import type {
  AccountType,
  TransactionType,
} from "../types/api";

const currencyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  currencyDisplay: "narrowSymbol",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const percentFormatter = new Intl.NumberFormat("en-US", {
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
});

const monthFormatter = new Intl.DateTimeFormat("en-US", {
  month: "short",
  timeZone: "UTC",
});

const longMonthFormatter = new Intl.DateTimeFormat("en-US", {
  month: "long",
  year: "numeric",
  timeZone: "UTC",
});

const transactionDateFormatter = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
  timeZone: "UTC",
});

const accountTypeLabels: Record<AccountType, string> = {
  CHECKING: "Checking",
  SAVINGS: "Savings",
  CREDIT_CARD: "Credit card",
};

const transactionTypeLabels: Record<TransactionType, string> = {
  INCOME: "Income",
  EXPENSE: "Expense",
  TRANSFER: "Transfer",
};

export function toFiniteAmount(value: string | number): number {
  const amount = typeof value === "number" ? value : Number(value);
  return Number.isFinite(amount) ? amount : 0;
}

export function formatMoney(value: string | number): string {
  const amount = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(amount)) {
    return "—";
  }
  return currencyFormatter.format(amount);
}

export function formatSignedMoney(
  value: string | number,
  type: TransactionType,
): string {
  const amount = Math.abs(toFiniteAmount(value));
  const prefix = type === "INCOME" ? "+" : type === "EXPENSE" ? "-" : "";
  return `${prefix}${currencyFormatter.format(amount)}`;
}

export function formatPercent(value: number): string {
  return `${percentFormatter.format(Number.isFinite(value) ? value : 0)}%`;
}

export function monthDate(month: string): Date | null {
  const match = /^(\d{4})-(\d{2})$/.exec(month);
  if (!match) {
    return null;
  }
  const date = new Date(
    Date.UTC(Number(match[1]), Number(match[2]) - 1, 1),
  );
  return Number.isNaN(date.getTime()) ? null : date;
}

export function formatMonthShort(month: string): string {
  const date = monthDate(month);
  return date ? monthFormatter.format(date) : month;
}

export function formatMonthLong(month: string): string {
  const date = monthDate(month);
  return date ? longMonthFormatter.format(date) : month;
}

export function formatTransactionDate(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "Unknown date"
    : transactionDateFormatter.format(date);
}

export function formatAccountType(value: AccountType): string {
  return accountTypeLabels[value];
}

export function formatTransactionType(value: TransactionType): string {
  return transactionTypeLabels[value];
}

export function getInitials(name: string): string {
  const parts = name
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2);
  if (parts.length === 0) {
    return "F";
  }
  return parts.map((part) => part[0]?.toUpperCase() ?? "").join("");
}
