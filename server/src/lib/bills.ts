import {
  Prisma,
  type BillStatus,
  type RecurringBill,
} from "@prisma/client";
import { prisma } from "./prisma";

const DAY_MS = 86_400_000;

export type BillSummary = {
  count: number;
  overdueCount: number;
  upcomingCount: number;
  paidCount: number;
  totalDue: string;
  overdueAmount: string;
  nextDue: {
    id: string;
    name: string;
    amount: string;
    dueDate: string;
    status: BillStatus;
  } | null;
};

export function startOfUtcDay(value: Date): Date {
  return new Date(
    Date.UTC(
      value.getUTCFullYear(),
      value.getUTCMonth(),
      value.getUTCDate(),
    ),
  );
}

export function billDueDate(value: Date): string {
  return value.toISOString().slice(0, 10);
}

// OVERDUE is derived from the due date instead of relying on a background job
// to rewrite stored statuses. PAID always wins, including for past-due bills.
export function effectiveBillStatus(
  bill: Pick<RecurringBill, "status" | "dueDate">,
  now = new Date(),
): BillStatus {
  if (bill.status === "PAID") {
    return "PAID";
  }
  if (startOfUtcDay(bill.dueDate).getTime() < startOfUtcDay(now).getTime()) {
    return "OVERDUE";
  }
  return "UPCOMING";
}

export function daysUntilBillDue(dueDate: Date, now = new Date()): number {
  return Math.round(
    (startOfUtcDay(dueDate).getTime() - startOfUtcDay(now).getTime()) /
      DAY_MS,
  );
}

export function toBillDto(bill: RecurringBill, now = new Date()) {
  return {
    id: bill.id,
    name: bill.name,
    amount: bill.amount.toFixed(2),
    frequency: bill.frequency,
    dueDate: billDueDate(bill.dueDate),
    status: effectiveBillStatus(bill, now),
    daysUntilDue: daysUntilBillDue(bill.dueDate, now),
    createdAt: bill.createdAt,
    updatedAt: bill.updatedAt,
  };
}

function statusRank(status: BillStatus): number {
  if (status === "OVERDUE") {
    return 0;
  }
  if (status === "UPCOMING") {
    return 1;
  }
  return 2;
}

// Unpaid bills come first, most urgent first. Paid bills are listed after them
// with the most recent due date first so the active workload stays on top.
export function sortBillsForDisplay(
  bills: RecurringBill[],
  now = new Date(),
): RecurringBill[] {
  return [...bills].sort((left, right) => {
    const leftStatus = effectiveBillStatus(left, now);
    const rightStatus = effectiveBillStatus(right, now);
    const rankDifference = statusRank(leftStatus) - statusRank(rightStatus);
    if (rankDifference !== 0) {
      return rankDifference;
    }

    const dueDifference =
      leftStatus === "PAID"
        ? right.dueDate.getTime() - left.dueDate.getTime()
        : left.dueDate.getTime() - right.dueDate.getTime();
    if (dueDifference !== 0) {
      return dueDifference;
    }

    const nameDifference = left.name.localeCompare(right.name);
    return nameDifference !== 0
      ? nameDifference
      : left.id.localeCompare(right.id);
  });
}

export function summarizeBills(
  bills: RecurringBill[],
  now = new Date(),
): BillSummary {
  let overdueCount = 0;
  let upcomingCount = 0;
  let paidCount = 0;
  let totalDue = new Prisma.Decimal(0);
  let overdueAmount = new Prisma.Decimal(0);
  let nextBill: RecurringBill | null = null;

  for (const bill of bills) {
    const status = effectiveBillStatus(bill, now);
    if (status === "PAID") {
      paidCount += 1;
      continue;
    }

    totalDue = totalDue.add(bill.amount);
    if (status === "OVERDUE") {
      overdueCount += 1;
      overdueAmount = overdueAmount.add(bill.amount);
    } else {
      upcomingCount += 1;
    }

    if (
      nextBill === null ||
      bill.dueDate.getTime() < nextBill.dueDate.getTime() ||
      (bill.dueDate.getTime() === nextBill.dueDate.getTime() &&
        (bill.name.localeCompare(nextBill.name) < 0 ||
          (bill.name === nextBill.name &&
            bill.id.localeCompare(nextBill.id) < 0)))
    ) {
      nextBill = bill;
    }
  }

  return {
    count: bills.length,
    overdueCount,
    upcomingCount,
    paidCount,
    totalDue: totalDue.toFixed(2),
    overdueAmount: overdueAmount.toFixed(2),
    nextDue: nextBill
      ? {
          id: nextBill.id,
          name: nextBill.name,
          amount: nextBill.amount.toFixed(2),
          dueDate: billDueDate(nextBill.dueDate),
          status: effectiveBillStatus(nextBill, now),
        }
      : null,
  };
}

export async function loadBills(
  userId: string,
  now = new Date(),
): Promise<RecurringBill[]> {
  const bills = await prisma.recurringBill.findMany({
    where: { userId },
    orderBy: [{ dueDate: "asc" }, { id: "asc" }],
  });
  return sortBillsForDisplay(bills, now);
}

export async function loadBillSummary(
  userId: string,
  now = new Date(),
): Promise<BillSummary> {
  const bills = await prisma.recurringBill.findMany({ where: { userId } });
  return summarizeBills(bills, now);
}
