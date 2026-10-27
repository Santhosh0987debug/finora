import { z } from "zod";
import { moneySchema } from "./accounts";

// The Prisma schema supports a TRANSFER enum value but has only one account
// relation per transaction (no destination account), so transfers cannot be
// represented safely. They are rejected here rather than inventing semantics.
export const transactionTypeSchema = z.enum(["INCOME", "EXPENSE"]);

const transactionFilterTypeSchema = z.enum([
  "INCOME",
  "EXPENSE",
  "TRANSFER",
]);

const idSchema = z
  .string()
  .trim()
  .min(1, "ID is required")
  .max(64, "ID is too long");

// Reuse the decimal-safe account money validator, then require a positive
// amount. Transaction direction is expressed by `type`, never by a negative
// amount.
export const transactionAmountSchema = moneySchema.refine(
  (value) => Number(value) > 0,
  { message: "Amount must be greater than zero" },
);

const transactionDateSchema = z
  .string()
  .trim()
  .min(1, "Transaction date is required")
  .refine(
    (value) => !Number.isNaN(Date.parse(value)),
    "Invalid transaction date",
  )
  .transform((value) => new Date(value));

const descriptionSchema = z
  .string()
  .trim()
  .max(500, "Description is too long")
  .nullable()
  .optional();

export const createTransactionSchema = z.strictObject({
  accountId: idSchema,
  categoryId: idSchema.nullable().optional(),
  amount: transactionAmountSchema,
  type: transactionTypeSchema,
  description: descriptionSchema,
  transactionDate: transactionDateSchema.optional(),
});

export type CreateTransactionInput = z.infer<typeof createTransactionSchema>;

export const updateTransactionSchema = z
  .strictObject({
    accountId: idSchema.optional(),
    categoryId: idSchema.nullable().optional(),
    amount: transactionAmountSchema.optional(),
    type: transactionTypeSchema.optional(),
    description: descriptionSchema,
    transactionDate: transactionDateSchema.optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: "No fields to update",
  });

export type UpdateTransactionInput = z.infer<typeof updateTransactionSchema>;

export const listTransactionsQuerySchema = z
  .object({
    page: z.coerce.number().int().min(1).max(1_000_000).optional(),
    limit: z.coerce.number().int().min(1).max(100).optional(),
    accountId: idSchema.optional(),
    categoryId: idSchema.optional(),
    type: transactionFilterTypeSchema.optional(),
    from: transactionDateSchema.optional(),
    to: transactionDateSchema.optional(),
  })
  .refine(
    (query) =>
      query.from === undefined ||
      query.to === undefined ||
      query.from.getTime() <= query.to.getTime(),
    { message: '"from" must be before or equal to "to"', path: ["from"] },
  );

export type ListTransactionsQuery = z.infer<typeof listTransactionsQuerySchema>;
