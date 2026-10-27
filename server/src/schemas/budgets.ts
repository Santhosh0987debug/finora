import { z } from "zod";
import { moneySchema } from "./accounts";

// Budget periods use the same UTC calendar months as transactions and the
// dashboard. A limit is money, so reuse the decimal-safe account validator.
export const budgetAmountSchema = moneySchema.refine(
  (value) => Number(value) > 0,
  { message: "Budget amount must be greater than zero" },
);

const MIN_YEAR = 1970;
const MAX_YEAR = 9_999;

export const budgetMonthSchema = z.coerce
  .number()
  .int()
  .min(1, "Month must be between 1 and 12")
  .max(12, "Month must be between 1 and 12");

export const budgetYearSchema = z.coerce
  .number()
  .int()
  .min(MIN_YEAR, `Year must be between ${MIN_YEAR} and ${MAX_YEAR}`)
  .max(MAX_YEAR, `Year must be between ${MIN_YEAR} and ${MAX_YEAR}`);

const idSchema = z
  .string()
  .trim()
  .min(1, "ID is required")
  .max(64, "ID is too long");

// Strict bodies prevent userId/id from being smuggled in; ownership always
// comes from the authenticated JWT.
export const createBudgetSchema = z.strictObject({
  categoryId: idSchema,
  amount: budgetAmountSchema,
  month: budgetMonthSchema,
  year: budgetYearSchema,
});

export type CreateBudgetInput = z.infer<typeof createBudgetSchema>;

export const updateBudgetSchema = z
  .strictObject({
    categoryId: idSchema.optional(),
    amount: budgetAmountSchema.optional(),
    month: budgetMonthSchema.optional(),
    year: budgetYearSchema.optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: "No fields to update",
  });

export type UpdateBudgetInput = z.infer<typeof updateBudgetSchema>;

export const listBudgetsQuerySchema = z.object({
  month: budgetMonthSchema.optional(),
  year: budgetYearSchema.optional(),
});

export type ListBudgetsQuery = z.infer<typeof listBudgetsQuerySchema>;
