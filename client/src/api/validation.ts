import { ApiError } from "./client";

export function invalidResponse(): never {
  throw new ApiError("The server returned an unexpected response.", 0);
}

export function asRecord(
  value: unknown,
  label: string,
): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new ApiError(`The ${label} in the server response is invalid.`, 0);
  }
  return value as Record<string, unknown>;
}

export function stringField(
  record: Record<string, unknown>,
  key: string,
  label: string,
): string {
  const value = record[key];
  if (typeof value !== "string") {
    throw new ApiError(`The ${label} in the server response is invalid.`, 0);
  }
  return value;
}

export function nullableStringField(
  record: Record<string, unknown>,
  key: string,
  label: string,
): string | null {
  const value = record[key];
  if (value === null || value === undefined) {
    return null;
  }
  if (typeof value !== "string") {
    throw new ApiError(`The ${label} in the server response is invalid.`, 0);
  }
  return value;
}

export function moneyField(
  record: Record<string, unknown>,
  key: string,
  label: string,
): string {
  const value = stringField(record, key, label);
  if (value.trim().length === 0 || !Number.isFinite(Number(value))) {
    throw new ApiError(`The ${label} in the server response is invalid.`, 0);
  }
  return value;
}

export function numberField(
  record: Record<string, unknown>,
  key: string,
  label: string,
): number {
  const value = record[key];
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new ApiError(`The ${label} in the server response is invalid.`, 0);
  }
  return value;
}

export function booleanField(
  record: Record<string, unknown>,
  key: string,
  label: string,
): boolean {
  const value = record[key];
  if (typeof value !== "boolean") {
    throw new ApiError(`The ${label} in the server response is invalid.`, 0);
  }
  return value;
}

export function dateField(
  record: Record<string, unknown>,
  key: string,
  label: string,
): string {
  const value = stringField(record, key, label);
  if (Number.isNaN(Date.parse(value))) {
    throw new ApiError(`The ${label} in the server response is invalid.`, 0);
  }
  return value;
}

export function oneOf<T extends string>(
  value: unknown,
  allowed: readonly T[],
  label: string,
): T {
  if (typeof value !== "string" || !allowed.includes(value as T)) {
    throw new ApiError(`The ${label} in the server response is invalid.`, 0);
  }
  return value as T;
}

export function arrayField(
  record: Record<string, unknown>,
  key: string,
  label: string,
): unknown[] {
  const value = record[key];
  if (!Array.isArray(value)) {
    throw new ApiError(`The ${label} in the server response is invalid.`, 0);
  }
  return value;
}
