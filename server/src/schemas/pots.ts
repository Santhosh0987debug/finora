import { z } from "zod";
import { moneySchema } from "./accounts";

const nameSchema = z
  .string()
  .trim()
  .min(1, "Name is required")
  .max(100, "Name is too long");

// A target must be positive; a saved balance may be zero but never negative.
export const potTargetAmountSchema = moneySchema.refine(
  (value) => Number(value) > 0,
  { message: "Target amount must be greater than zero" },
);

export const potCurrentAmountSchema = moneySchema.refine(
  (value) => Number(value) >= 0,
  { message: "Current amount cannot be negative" },
);

export const potMovementAmountSchema = moneySchema.refine(
  (value) => Number(value) > 0,
  { message: "Amount must be greater than zero" },
);

const DATE_ONLY_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

function parseDateOnly(value: string): Date | null {
  const match = DATE_ONLY_PATTERN.exec(value);
  if (!match) {
    return null;
  }
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return null;
  }
  return date;
}

export const potTargetDateSchema = z
  .string()
  .trim()
  .refine(
    (value) => parseDateOnly(value) !== null,
    "Target date must be a valid date in YYYY-MM-DD format",
  )
  .transform((value) => parseDateOnly(value) as Date);

export const createPotSchema = z.strictObject({
  name: nameSchema,
  targetAmount: potTargetAmountSchema,
  currentAmount: potCurrentAmountSchema.optional(),
  targetDate: potTargetDateSchema.nullable().optional(),
});

export type CreatePotInput = z.infer<typeof createPotSchema>;

export const updatePotSchema = z
  .strictObject({
    name: nameSchema.optional(),
    targetAmount: potTargetAmountSchema.optional(),
    currentAmount: potCurrentAmountSchema.optional(),
    targetDate: potTargetDateSchema.nullable().optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: "No fields to update",
  });

export type UpdatePotInput = z.infer<typeof updatePotSchema>;

export const potMovementSchema = z.strictObject({
  amount: potMovementAmountSchema,
});

export type PotMovementInput = z.infer<typeof potMovementSchema>;
