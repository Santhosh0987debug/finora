import type {
  TransactionListResponse,
  TransactionMutationInput,
  TransactionMutationType,
  TransactionPagination,
  TransactionRecord,
  TransactionType,
} from "../types/api";
import { apiRequest } from "./client";
import {
  arrayField,
  asRecord,
  booleanField,
  dateField,
  invalidResponse,
  moneyField,
  nullableStringField,
  numberField,
  oneOf,
  stringField,
} from "./validation";

const TRANSACTION_TYPES: readonly TransactionType[] = [
  "INCOME",
  "EXPENSE",
  "TRANSFER",
];
const MUTATION_TYPES: readonly TransactionMutationType[] = [
  "INCOME",
  "EXPENSE",
];

export interface TransactionQuery {
  page?: number;
  limit?: number;
  accountId?: string;
  categoryId?: string;
  type?: TransactionType;
  from?: string;
  to?: string;
}

function parseTransaction(value: unknown): TransactionRecord {
  const transaction = asRecord(value, "transaction");
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
    createdAt: dateField(transaction, "createdAt", "transaction creation date"),
    updatedAt: dateField(transaction, "updatedAt", "transaction update date"),
  };
}

function parsePagination(value: unknown): TransactionPagination {
  const pagination = asRecord(value, "pagination");
  const page = numberField(pagination, "page", "pagination page");
  const limit = numberField(pagination, "limit", "pagination limit");
  const total = numberField(pagination, "total", "pagination total");
  const totalPages = numberField(
    pagination,
    "totalPages",
    "pagination total pages",
  );
  if (
    !Number.isInteger(page) ||
    !Number.isInteger(limit) ||
    !Number.isInteger(total) ||
    !Number.isInteger(totalPages) ||
    page < 1 ||
    limit < 1 ||
    total < 0 ||
    totalPages < 0
  ) {
    invalidResponse();
  }
  return {
    page,
    limit,
    total,
    totalPages,
    hasNext: booleanField(pagination, "hasNext", "pagination next state"),
    hasPrevious: booleanField(
      pagination,
      "hasPrevious",
      "pagination previous state",
    ),
  };
}

function parseTransactionList(value: unknown): TransactionListResponse {
  const response = asRecord(value, "transaction list response");
  return {
    transactions: arrayField(
      response,
      "transactions",
      "transactions",
    ).map(parseTransaction),
    pagination: parsePagination(response.pagination),
  };
}

function parseTransactionResponse(value: unknown): TransactionRecord {
  const response = asRecord(value, "transaction response");
  return parseTransaction(response.transaction);
}

function toQueryString(query: TransactionQuery): string {
  const params = new URLSearchParams();
  if (query.page !== undefined) {
    params.set("page", String(query.page));
  }
  if (query.limit !== undefined) {
    params.set("limit", String(query.limit));
  }
  if (query.accountId) {
    params.set("accountId", query.accountId);
  }
  if (query.categoryId) {
    params.set("categoryId", query.categoryId);
  }
  if (query.type) {
    params.set("type", query.type);
  }
  if (query.from) {
    params.set("from", query.from);
  }
  if (query.to) {
    params.set("to", query.to);
  }
  const serialized = params.toString();
  return serialized.length > 0 ? `?${serialized}` : "";
}

export async function fetchTransactions(
  token: string,
  query: TransactionQuery,
  signal?: AbortSignal,
): Promise<TransactionListResponse> {
  const payload = await apiRequest<unknown>(
    `/api/transactions${toQueryString(query)}`,
    { token, signal },
  );
  return parseTransactionList(payload);
}

export async function createTransaction(
  token: string,
  input: TransactionMutationInput,
): Promise<TransactionRecord> {
  const payload = await apiRequest<unknown>("/api/transactions", {
    method: "POST",
    token,
    body: input,
  });
  return parseTransactionResponse(payload);
}

export async function updateTransaction(
  token: string,
  id: string,
  input: TransactionMutationInput,
): Promise<TransactionRecord> {
  const payload = await apiRequest<unknown>(
    `/api/transactions/${encodeURIComponent(id)}`,
    {
      method: "PATCH",
      token,
      body: input,
    },
  );
  return parseTransactionResponse(payload);
}

export async function deleteTransaction(
  token: string,
  id: string,
): Promise<void> {
  await apiRequest<unknown>(`/api/transactions/${encodeURIComponent(id)}`, {
    method: "DELETE",
    token,
  });
}

export { MUTATION_TYPES };
