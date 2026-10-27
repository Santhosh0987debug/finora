import type {
  BillEditableStatus,
  BillFrequency,
  BillMutationInput,
  BillRecord,
  BillStatus,
  DashboardBillSummary,
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

const BILL_FREQUENCIES: readonly BillFrequency[] = [
  "WEEKLY",
  "MONTHLY",
  "QUARTERLY",
  "YEARLY",
];
const BILL_STATUSES: readonly BillStatus[] = [
  "UPCOMING",
  "PAID",
  "OVERDUE",
];
const EDITABLE_BILL_STATUSES: readonly BillEditableStatus[] = [
  "UPCOMING",
  "PAID",
];
const DATE_ONLY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function dateOnlyField(
  record: Record<string, unknown>,
  key: string,
  label: string,
): string {
  const value = stringField(record, key, label);
  if (!DATE_ONLY_PATTERN.test(value)) {
    invalidResponse();
  }
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    invalidResponse();
  }
  return value;
}

function integerField(
  record: Record<string, unknown>,
  key: string,
  label: string,
): number {
  const value = numberField(record, key, label);
  if (!Number.isInteger(value)) {
    invalidResponse();
  }
  return value;
}

function parseBill(value: unknown): BillRecord {
  const bill = asRecord(value, "recurring bill");
  const daysUntilDue = integerField(
    bill,
    "daysUntilDue",
    "bill due distance",
  );
  return {
    id: stringField(bill, "id", "recurring bill id"),
    name: stringField(bill, "name", "recurring bill name"),
    amount: moneyField(bill, "amount", "recurring bill amount"),
    frequency: oneOf(
      bill.frequency,
      BILL_FREQUENCIES,
      "recurring bill frequency",
    ),
    dueDate: dateOnlyField(bill, "dueDate", "recurring bill due date"),
    status: oneOf(bill.status, BILL_STATUSES, "recurring bill status"),
    daysUntilDue,
    createdAt: dateField(bill, "createdAt", "recurring bill creation date"),
    updatedAt: dateField(bill, "updatedAt", "recurring bill update date"),
  };
}

function parseNextDue(value: unknown): DashboardBillSummary["nextDue"] {
  if (value === null) {
    return null;
  }
  const next = asRecord(value, "next recurring bill");
  const status = oneOf(
    next.status,
    ["UPCOMING", "OVERDUE"] as const,
    "next recurring bill status",
  );
  return {
    id: stringField(next, "id", "next recurring bill id"),
    name: stringField(next, "name", "next recurring bill name"),
    amount: moneyField(next, "amount", "next recurring bill amount"),
    dueDate: dateOnlyField(
      next,
      "dueDate",
      "next recurring bill due date",
    ),
    status,
  };
}

export function parseBillSummary(value: unknown): DashboardBillSummary {
  const summary = asRecord(value, "recurring bill summary");
  const count = integerField(summary, "count", "recurring bill count");
  const overdueCount = integerField(
    summary,
    "overdueCount",
    "overdue bill count",
  );
  const upcomingCount = integerField(
    summary,
    "upcomingCount",
    "upcoming bill count",
  );
  const paidCount = integerField(
    summary,
    "paidCount",
    "paid bill count",
  );
  if (
    count < 0 ||
    overdueCount < 0 ||
    upcomingCount < 0 ||
    paidCount < 0 ||
    overdueCount + upcomingCount + paidCount !== count
  ) {
    invalidResponse();
  }

  const nextDue = parseNextDue(summary.nextDue);
  const unpaidCount = overdueCount + upcomingCount;
  if ((unpaidCount > 0) !== (nextDue !== null)) {
    invalidResponse();
  }

  return {
    count,
    overdueCount,
    upcomingCount,
    paidCount,
    totalDue: moneyField(summary, "totalDue", "total unpaid bills"),
    overdueAmount: moneyField(
      summary,
      "overdueAmount",
      "overdue bill total",
    ),
    nextDue,
  };
}

function parseBillResponse(value: unknown): BillRecord {
  const response = asRecord(value, "recurring bill response");
  return parseBill(response.bill);
}

export async function fetchBills(
  token: string,
  signal?: AbortSignal,
): Promise<BillRecord[]> {
  const payload = await apiRequest<unknown>("/api/bills", { token, signal });
  const response = asRecord(payload, "recurring bills response");
  return arrayField(response, "bills", "recurring bills").map(parseBill);
}

export async function createBill(
  token: string,
  input: BillMutationInput,
): Promise<BillRecord> {
  const payload = await apiRequest<unknown>("/api/bills", {
    method: "POST",
    token,
    body: input,
  });
  return parseBillResponse(payload);
}

export async function updateBill(
  token: string,
  id: string,
  input: BillMutationInput,
): Promise<BillRecord> {
  const payload = await apiRequest<unknown>(
    `/api/bills/${encodeURIComponent(id)}`,
    {
      method: "PATCH",
      token,
      body: input,
    },
  );
  return parseBillResponse(payload);
}

export async function setBillStatus(
  token: string,
  id: string,
  status: BillEditableStatus,
): Promise<BillRecord> {
  if (!EDITABLE_BILL_STATUSES.includes(status)) {
    throw new Error("That bill status cannot be set directly.");
  }
  const payload = await apiRequest<unknown>(
    `/api/bills/${encodeURIComponent(id)}/status`,
    {
      method: "PATCH",
      token,
      body: { status },
    },
  );
  return parseBillResponse(payload);
}

export async function deleteBill(
  token: string,
  id: string,
): Promise<void> {
  await apiRequest<unknown>(`/api/bills/${encodeURIComponent(id)}`, {
    method: "DELETE",
    token,
  });
}
