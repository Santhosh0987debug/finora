import type {
  Category,
  TransactionMutationInput,
  TransactionMutationType,
  TransactionRecord,
} from "../types/api";

const MONEY_PATTERN = /^\d+(\.\d{1,2})?$/;
const MAX_AMOUNT = 9_999_999_999.99;

export interface TransactionFormValues {
  type: TransactionMutationType;
  amount: string;
  accountId: string;
  categoryId: string;
  transactionDate: string;
  description: string;
}

export type TransactionFormErrors = Partial<
  Record<keyof TransactionFormValues, string>
>;

export interface TransactionFilterValues {
  type: "" | TransactionMutationType;
  accountId: string;
  categoryId: string;
  from: string;
  to: string;
}

export const EMPTY_TRANSACTION_FILTERS: TransactionFilterValues = {
  type: "",
  accountId: "",
  categoryId: "",
  from: "",
  to: "",
};

export function hasTransactionFilters(
  filters: TransactionFilterValues,
): boolean {
  return Object.values(filters).some((value) => value.length > 0);
}

export function transactionMatchesFilters(
  input: TransactionMutationInput,
  filters: TransactionFilterValues,
): boolean {
  if (filters.type && input.type !== filters.type) {
    return false;
  }
  if (filters.accountId && input.accountId !== filters.accountId) {
    return false;
  }
  if (
    filters.categoryId &&
    (input.categoryId ?? "") !== filters.categoryId
  ) {
    return false;
  }
  if (filters.from && input.transactionDate < `${filters.from}T00:00:00.000Z`) {
    return false;
  }
  if (filters.to && input.transactionDate > `${filters.to}T23:59:59.999Z`) {
    return false;
  }
  return true;
}

export function todayInputValue(): string {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, "0");
  const day = String(today.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function dateInputValue(value: string): string {
  const match = /^(\d{4}-\d{2}-\d{2})/.exec(value);
  return match?.[1] ?? todayInputValue();
}

export function transactionDateFromInput(value: string): string {
  return `${value}T00:00:00.000Z`;
}

export function emptyTransactionForm(accountId: string): TransactionFormValues {
  return {
    type: "EXPENSE",
    amount: "",
    accountId,
    categoryId: "",
    transactionDate: todayInputValue(),
    description: "",
  };
}

export function formValuesFromTransaction(
  transaction: TransactionRecord,
): TransactionFormValues {
  return {
    type:
      transaction.type === "TRANSFER" ? "EXPENSE" : transaction.type,
    amount: transaction.amount,
    accountId: transaction.accountId,
    categoryId: transaction.categoryId ?? "",
    transactionDate: dateInputValue(transaction.transactionDate),
    description: transaction.description ?? "",
  };
}

export function validateTransactionForm(
  values: TransactionFormValues,
  categories: Category[],
): TransactionFormErrors {
  const errors: TransactionFormErrors = {};
  const amountText = values.amount.trim();

  if (!values.accountId) {
    errors.accountId = "Choose an account.";
  }

  if (!amountText) {
    errors.amount = "Enter an amount.";
  } else if (!MONEY_PATTERN.test(amountText)) {
    errors.amount = "Use a positive number with at most two decimal places.";
  } else {
    const amount = Number(amountText);
    if (!Number.isFinite(amount) || amount <= 0) {
      errors.amount = "Amount must be greater than zero.";
    } else if (amount > MAX_AMOUNT) {
      errors.amount = "Amount is out of range.";
    }
  }

  if (!values.transactionDate) {
    errors.transactionDate = "Choose a transaction date.";
  } else if (
    !/^\d{4}-\d{2}-\d{2}$/.test(values.transactionDate) ||
    Number.isNaN(
      Date.parse(transactionDateFromInput(values.transactionDate)),
    )
  ) {
    errors.transactionDate = "Choose a valid transaction date.";
  }

  if (values.description.trim().length > 500) {
    errors.description = "Description must be 500 characters or fewer.";
  }

  if (values.categoryId) {
    const category = categories.find(
      (candidate) => candidate.id === values.categoryId,
    );
    if (category && category.type !== values.type) {
      errors.categoryId = "Choose a category that matches the transaction type.";
    }
  }

  return errors;
}

export function toTransactionMutationInput(
  values: TransactionFormValues,
): TransactionMutationInput {
  const description = values.description.trim();
  return {
    accountId: values.accountId,
    categoryId: values.categoryId || null,
    amount: values.amount.trim(),
    type: values.type,
    description: description.length > 0 ? description : null,
    transactionDate: transactionDateFromInput(values.transactionDate),
  };
}
