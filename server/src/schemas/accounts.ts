import { z } from "zod";

// Exact AccountType enum values from server/prisma/schema.prisma.
const ACCOUNT_TYPES = ["CHECKING", "SAVINGS", "CREDIT_CARD"] as const;

// NUMERIC(12, 2) upper bound.
const MAX_AMOUNT = 9_999_999_999.99;
const MONEY_PATTERN = /^-?\d+(\.\d{1,2})?$/;

// Decimal-safe money input. Accepts a JSON number or a decimal string and
// normalizes to a plain decimal string, which is passed to Prisma as-is so
// no binary floating-point value ever touches financial storage. Rejects
// NaN, Infinity, scientific notation, float artifacts (e.g. 0.30000000000000004)
// and anything beyond two decimal places.
export const moneySchema = z
  .union([z.number(), z.string()])
  .refine(
    (value) => {
      if (typeof value === "number") {
        return Number.isFinite(value) && MONEY_PATTERN.test(String(value));
      }
      const text = value.trim();
      return text.length > 0 && MONEY_PATTERN.test(text);
    },
    { message: "Amount must be a finite value with at most two decimal places" },
  )
  .transform((value) => (typeof value === "number" ? String(value) : value.trim()))
  .refine((text) => Math.abs(Number(text)) <= MAX_AMOUNT, {
    message: "Amount is out of range",
  });

export type MoneyInput = z.infer<typeof moneySchema>;

const nameSchema = z
  .string()
  .trim()
  .min(1, "Name is required")
  .max(100, "Name is too long");

const currencySchema = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^[A-Z]{3}$/, "Currency must be a 3-letter code (e.g. USD)");

// Strict objects: unknown keys such as userId or id are rejected instead
// of silently ignored, so ownership fields can never be smuggled in.
export const createAccountSchema = z.strictObject({
  name: nameSchema,
  type: z.enum(ACCOUNT_TYPES),
  balance: moneySchema.optional(),
  currency: currencySchema.optional(),
});

export type CreateAccountInput = z.infer<typeof createAccountSchema>;

export const updateAccountSchema = z
  .strictObject({
    name: nameSchema.optional(),
    type: z.enum(ACCOUNT_TYPES).optional(),
    balance: moneySchema.optional(),
    currency: currencySchema.optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: "No fields to update",
  });

export type UpdateAccountInput = z.infer<typeof updateAccountSchema>;
