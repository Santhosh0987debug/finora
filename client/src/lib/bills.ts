import type {
  BillFrequency,
  BillMutationInput,
  BillRecord,
  BillStatus,
} from "../types/api";

const MONEY_PATTERN = /^\d+(\.\d{1,2})?$/;
const MAX_AMOUNT = 9_999_999_999.99;
const DATE_ONLY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

const billDateFormatter = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
  timeZone: "UTC",
});

export const BILL_FREQUENCIES: readonly BillFrequency[] = [
  "WEEKLY",
  "MONTHLY",
  "QUARTERLY",
  "YEARLY",
];

export const BILL_FREQUENCY_LABELS: Record<BillFrequency, string> = {
  WEEKLY: "Weekly",
  MONTHLY: "Monthly",
  QUARTERLY: "Quarterly",
  YEARLY: "Yearly",
};

export const BILL_STATUS_LABELS: Record<BillStatus, string> = {
  UPCOMING: "Upcoming",
  OVERDUE: "Overdue",
  PAID: "Paid",
};

export interface BillFormValues {
  name: string;
  amount: string;
  frequency: BillFrequency;
  dueDate: string;
}

export type BillFormErrors = Partial<Record<keyof BillFormValues, string>>;

function todayDateOnly(): string {
  return new Date().toISOString().slice(0, 10);
}

function isValidDateOnly(value: string): boolean {
  if (!DATE_ONLY_PATTERN.test(value)) {
    return false;
  }
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

export function emptyBillForm(): BillFormValues {
  return {
    name: "",
    amount: "",
    frequency: "MONTHLY",
    dueDate: todayDateOnly(),
  };
}

export function billFormFromRecord(bill: BillRecord): BillFormValues {
  return {
    name: bill.name,
    amount: bill.amount,
    frequency: bill.frequency,
    dueDate: bill.dueDate,
  };
}

export function validateBillForm(values: BillFormValues): BillFormErrors {
  const errors: BillFormErrors = {};
  const name = values.name.trim();
  const amountText = values.amount.trim();
  const dueDate = values.dueDate.trim();

  if (!name) {
    errors.name = "Enter a name for this bill.";
  } else if (name.length > 100) {
    errors.name = "Name must be 100 characters or fewer.";
  }

  if (!amountText) {
    errors.amount = "Enter the bill amount.";
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

  if (!BILL_FREQUENCIES.includes(values.frequency)) {
    errors.frequency = "Choose how often this bill repeats.";
  }

  if (!dueDate) {
    errors.dueDate = "Choose the next due date.";
  } else if (!isValidDateOnly(dueDate)) {
    errors.dueDate = "Enter a valid due date.";
  }

  return errors;
}

export function toBillMutationInput(
  values: BillFormValues,
): BillMutationInput {
  return {
    name: values.name.trim(),
    amount: values.amount.trim(),
    frequency: values.frequency,
    dueDate: values.dueDate.trim(),
  };
}

export function formatBillDueDate(dueDate: string): string {
  const date = new Date(`${dueDate}T00:00:00.000Z`);
  return Number.isNaN(date.getTime())
    ? dueDate
    : billDateFormatter.format(date);
}

export function billDueLabel(bill: BillRecord): string {
  if (bill.status === "PAID") {
    return "Paid";
  }
  if (bill.daysUntilDue < 0) {
    const days = Math.abs(bill.daysUntilDue);
    return `${days} day${days === 1 ? "" : "s"} overdue`;
  }
  if (bill.daysUntilDue === 0) {
    return "Due today";
  }
  if (bill.daysUntilDue === 1) {
    return "Due tomorrow";
  }
  return `Due in ${bill.daysUntilDue} days`;
}
