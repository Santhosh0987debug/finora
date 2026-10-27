import type {
  PotMovementInput,
  PotMutationInput,
  PotRecord,
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
  stringField,
} from "./validation";

const DATE_ONLY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function parseTargetDate(value: unknown): string | null {
  const date = nullableStringField(
    { targetDate: value },
    "targetDate",
    "target date",
  );
  if (date !== null && !DATE_ONLY_PATTERN.test(date)) {
    invalidResponse();
  }
  return date;
}

function parsePot(value: unknown): PotRecord {
  const pot = asRecord(value, "savings pot");
  const targetDate = parseTargetDate(pot.targetDate);
  return {
    id: stringField(pot, "id", "savings pot id"),
    name: stringField(pot, "name", "savings pot name"),
    targetAmount: moneyField(pot, "targetAmount", "target amount"),
    currentAmount: moneyField(pot, "currentAmount", "current saved amount"),
    targetDate,
    remaining: moneyField(pot, "remaining", "remaining amount"),
    percentage: numberField(pot, "percentage", "pot progress"),
    isComplete: booleanField(pot, "isComplete", "pot completion state"),
    createdAt: dateField(pot, "createdAt", "pot creation date"),
    updatedAt: dateField(pot, "updatedAt", "pot update date"),
  };
}

function parsePotResponse(value: unknown): PotRecord {
  const response = asRecord(value, "savings pot response");
  return parsePot(response.pot);
}

export async function fetchPots(
  token: string,
  signal?: AbortSignal,
): Promise<PotRecord[]> {
  const payload = await apiRequest<unknown>("/api/pots", { token, signal });
  const response = asRecord(payload, "savings pots response");
  return arrayField(response, "pots", "savings pots").map(parsePot);
}

export async function createPot(
  token: string,
  input: PotMutationInput,
): Promise<PotRecord> {
  const payload = await apiRequest<unknown>("/api/pots", {
    method: "POST",
    token,
    body: input,
  });
  return parsePotResponse(payload);
}

export async function updatePot(
  token: string,
  id: string,
  input: PotMutationInput,
): Promise<PotRecord> {
  const payload = await apiRequest<unknown>(
    `/api/pots/${encodeURIComponent(id)}`,
    {
      method: "PATCH",
      token,
      body: input,
    },
  );
  return parsePotResponse(payload);
}

export async function deletePot(
  token: string,
  id: string,
): Promise<void> {
  await apiRequest<unknown>(`/api/pots/${encodeURIComponent(id)}`, {
    method: "DELETE",
    token,
  });
}

export async function movePotMoney(
  token: string,
  id: string,
  direction: "deposit" | "withdraw",
  input: PotMovementInput,
): Promise<PotRecord> {
  const payload = await apiRequest<unknown>(
    `/api/pots/${encodeURIComponent(id)}/${direction}`,
    {
      method: "POST",
      token,
      body: input,
    },
  );
  return parsePotResponse(payload);
}
