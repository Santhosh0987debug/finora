import type { Account, AccountType } from "../types/api";
import { apiRequest } from "./client";
import {
  arrayField,
  asRecord,
  dateField,
  moneyField,
  oneOf,
  stringField,
} from "./validation";

const ACCOUNT_TYPES: readonly AccountType[] = [
  "CHECKING",
  "SAVINGS",
  "CREDIT_CARD",
];

function parseAccount(value: unknown): Account {
  const account = asRecord(value, "account");
  return {
    id: stringField(account, "id", "account id"),
    name: stringField(account, "name", "account name"),
    type: oneOf(account.type, ACCOUNT_TYPES, "account type"),
    balance: moneyField(account, "balance", "account balance"),
    currency: stringField(account, "currency", "account currency"),
    createdAt: dateField(account, "createdAt", "account creation date"),
    updatedAt: dateField(account, "updatedAt", "account update date"),
  };
}

export async function fetchAccounts(
  token: string,
  signal?: AbortSignal,
): Promise<Account[]> {
  const payload = await apiRequest<unknown>("/api/accounts", {
    token,
    signal,
  });
  const response = asRecord(payload, "accounts response");
  return arrayField(response, "accounts", "accounts").map(parseAccount);
}
