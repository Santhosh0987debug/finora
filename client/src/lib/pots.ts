import type { PotMutationInput, PotRecord } from "../types/api";
import { formatMoney, toFiniteAmount } from "./format";

const MONEY_PATTERN = /^\d+(\.\d{1,2})?$/;
const MAX_AMOUNT = 9_999_999_999.99;
const DATE_ONLY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export interface PotFormValues {
  name: string;
  targetAmount: string;
  currentAmount: string;
  targetDate: string;
}

export type PotFormErrors = Partial<Record<keyof PotFormValues, string>>;

export interface PotMovementValues {
  amount: string;
}

export type PotMovementErrors = Partial<Record<keyof PotMovementValues, string>>;

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

function validateMoney(
  value: string,
  label: string,
  options: { allowZero: boolean },
): string | undefined {
  const text = value.trim();
  if (!text) {
    return `Enter ${label}.`;
  }
  if (!MONEY_PATTERN.test(text)) {
    return "Use a number with at most two decimal places.";
  }
  const amount = Number(text);
  if (!Number.isFinite(amount) || amount > MAX_AMOUNT) {
    return "Amount is out of range.";
  }
  if (amount < 0) {
    return "Amount cannot be negative.";
  }
  if (!options.allowZero && amount === 0) {
    return "Amount must be greater than zero.";
  }
  return undefined;
}

export function emptyPotForm(): PotFormValues {
  return {
    name: "",
    targetAmount: "",
    currentAmount: "0",
    targetDate: "",
  };
}

export function potFormFromRecord(pot: PotRecord): PotFormValues {
  return {
    name: pot.name,
    targetAmount: pot.targetAmount,
    currentAmount: pot.currentAmount,
    targetDate: pot.targetDate ?? "",
  };
}

export function validatePotForm(values: PotFormValues): PotFormErrors {
  const errors: PotFormErrors = {};
  const name = values.name.trim();
  if (!name) {
    errors.name = "Enter a name for this savings pot.";
  } else if (name.length > 100) {
    errors.name = "Name must be 100 characters or fewer.";
  }

  const targetError = validateMoney(values.targetAmount, "a target amount", {
    allowZero: false,
  });
  if (targetError) {
    errors.targetAmount = targetError;
  }

  const currentText = values.currentAmount.trim();
  const currentError =
    currentText.length === 0
      ? undefined
      : validateMoney(values.currentAmount, "the current saved amount", {
          allowZero: true,
        });
  if (currentError) {
    errors.currentAmount = currentError;
  } else if (
    !targetError &&
    currentText.length > 0 &&
    Number(currentText) > Number(values.targetAmount.trim())
  ) {
    errors.currentAmount = "Current saved amount cannot exceed the target.";
  }

  const targetDate = values.targetDate.trim();
  if (targetDate && !isValidDateOnly(targetDate)) {
    errors.targetDate = "Enter a valid target date.";
  }

  return errors;
}

export function toPotMutationInput(values: PotFormValues): PotMutationInput {
  return {
    name: values.name.trim(),
    targetAmount: values.targetAmount.trim(),
    currentAmount: values.currentAmount.trim() || "0",
    targetDate: values.targetDate.trim() || null,
  };
}

export function validatePotMovement(
  pot: PotRecord,
  direction: "deposit" | "withdraw",
  values: PotMovementValues,
): PotMovementErrors {
  const amountError = validateMoney(values.amount, "an amount", {
    allowZero: false,
  });
  if (amountError) {
    return { amount: amountError };
  }

  const amount = Number(values.amount.trim());
  if (direction === "deposit") {
    const remaining = toFiniteAmount(pot.remaining);
    if (amount > remaining) {
      return {
        amount: `You can add up to ${formatMoney(remaining)} to this pot.`,
      };
    }
  } else if (amount > toFiniteAmount(pot.currentAmount)) {
    return {
      amount: `You can withdraw up to ${formatMoney(pot.currentAmount)}.`,
    };
  }
  return {};
}

export function potProgressWidth(percentage: number): number {
  if (!Number.isFinite(percentage)) {
    return 0;
  }
  return Math.min(100, Math.max(0, percentage));
}
