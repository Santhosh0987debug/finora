import { z } from "zod";
import { moneySchema } from "./accounts";

const nameSchema = z
  .string()
  .trim()
  .min(1, "Bill name is required")
  .max(100, "Bill name is too long");

export const billAmountSchema = moneySchema.refine(
  (value) => Number(value) > 0,
  { message: "Amount must be greater than zero" },
);

export const billFrequencySchema = z.enum([
  "WEEKLY",
  "MONTHLY",
  "QUARTERLY",
  "YEARLY",
]);

// OVERDUE is derived from the due date, so clients may only store the two
// states they can actually choose: upcoming or paid.
export const editableBillStatusSchema = z.enum(["UPCOMING", "PAID"]);

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

export const billDueDateSchema = z
  .string()
  .trim()
  .refine(
    (value) => parseDateOnly(value) !== null,
    "Due date must be a valid date in YYYY-MM-DD format",
  )
  .transform((value) => parseDateOnly(value) as Date);

export const createBillSchema = z.strictObject({
  name: nameSchema,
  amount: billAmountSchema,
  frequency: billFrequencySchema,
  dueDate: billDueDateSchema,
  status: editableBillStatusSchema.optional(),
});

export type CreateBillInput = z.infer<typeof createBillSchema>;

export const updateBillSchema = z
  .strictObject({
    name: nameSchema.optional(),
    amount: billAmountSchema.optional(),
    frequency: billFrequencySchema.optional(),
    dueDate: billDueDateSchema.optional(),
    status: editableBillStatusSchema.optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: "No fields to update",
  });

export type UpdateBillInput = z.infer<typeof updateBillSchema>;

export const updateBillStatusSchema = z.strictObject({
  status: editableBillStatusSchema,
});

export type UpdateBillStatusInput = z.infer<
  typeof updateBillStatusSchema
>;
