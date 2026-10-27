// Unit tests for Step 6 transaction validation (no database access).
// Run with: npm run test:unit --workspace=server
import { deepStrictEqual, equal, ok } from "node:assert";
import { describe, it } from "node:test";
import {
  createTransactionSchema,
  listTransactionsQuerySchema,
  transactionAmountSchema,
  updateTransactionSchema,
} from "../src/schemas/transactions.js";

describe("transactionAmountSchema", () => {
  it("accepts positive decimal values and normalizes numbers to strings", () => {
    deepStrictEqual(
      [
        transactionAmountSchema.safeParse(1),
        transactionAmountSchema.safeParse(10.5),
        transactionAmountSchema.safeParse("100.50"),
        transactionAmountSchema.safeParse("  0.01  "),
      ].map((result) => (result.success ? result.data : null)),
      ["1", "10.5", "100.50", "0.01"],
    );
  });

  it("rejects zero, negatives, float artifacts, scientific notation and >2 decimals", () => {
    for (const value of [
      0,
      "0",
      "-1",
      -0.01,
      10.001,
      "10.001",
      0.30000000000000004,
      "1e3",
      "abc",
      "",
      "   ",
      10_000_000_000,
    ]) {
      equal(
        transactionAmountSchema.safeParse(value).success,
        false,
        `expected rejection: ${String(value)}`,
      );
    }
  });
});

describe("createTransactionSchema", () => {
  it("accepts a full body and normalizes fields", () => {
    const parsed = createTransactionSchema.safeParse({
      accountId: "  account-1 ",
      categoryId: "category-1",
      amount: "250.50",
      type: "EXPENSE",
      description: "  Groceries  ",
      transactionDate: "2024-03-01T12:30:00.000Z",
    });
    ok(parsed.success);
    deepStrictEqual(
      {
        accountId: parsed.data.accountId,
        categoryId: parsed.data.categoryId,
        amount: parsed.data.amount,
        type: parsed.data.type,
        description: parsed.data.description,
        transactionDate: parsed.data.transactionDate.toISOString(),
      },
      {
        accountId: "account-1",
        categoryId: "category-1",
        amount: "250.50",
        type: "EXPENSE",
        description: "Groceries",
        transactionDate: "2024-03-01T12:30:00.000Z",
      },
    );
  });

  it("accepts omitted or null optional fields", () => {
    const minimal = createTransactionSchema.safeParse({
      accountId: "account-1",
      amount: "10.00",
      type: "INCOME",
    });
    ok(minimal.success);
    equal(minimal.data.categoryId, undefined);
    equal(minimal.data.description, undefined);
    equal(minimal.data.transactionDate, undefined);

    const nulls = createTransactionSchema.safeParse({
      accountId: "account-1",
      categoryId: null,
      amount: "10.00",
      type: "INCOME",
      description: null,
    });
    ok(nulls.success);
    equal(nulls.data.categoryId, null);
    equal(nulls.data.description, null);
  });

  it("rejects missing required fields, unsupported transfers and bad dates", () => {
    for (const body of [
      { amount: "10.00", type: "INCOME" },
      { accountId: "account-1", type: "INCOME" },
      { accountId: "account-1", amount: "10.00" },
      { accountId: "account-1", amount: "0", type: "INCOME" },
      { accountId: "account-1", amount: "-5", type: "EXPENSE" },
      { accountId: "account-1", amount: "10.00", type: "TRANSFER" },
      {
        accountId: "account-1",
        amount: "10.00",
        type: "INCOME",
        transactionDate: "not-a-date",
      },
      {
        accountId: "account-1",
        amount: "10.00",
        type: "INCOME",
        description: "x".repeat(501),
      },
    ]) {
      equal(
        createTransactionSchema.safeParse(body).success,
        false,
        `expected rejection: ${JSON.stringify(body)}`,
      );
    }
  });

  it("rejects smuggled ownership and unknown fields", () => {
    for (const body of [
      { accountId: "a", amount: "10", type: "INCOME", userId: "other" },
      { accountId: "a", amount: "10", type: "INCOME", id: "fixed" },
      { accountId: "a", amount: "10", type: "INCOME", account: {} },
    ]) {
      equal(
        createTransactionSchema.safeParse(body).success,
        false,
        `expected rejection: ${JSON.stringify(body)}`,
      );
    }
  });
});

describe("updateTransactionSchema", () => {
  it("accepts partial updates including explicit null category", () => {
    for (const body of [
      { amount: "5.00" },
      { accountId: "account-2" },
      { type: "EXPENSE" },
      { categoryId: null },
      { description: null },
      { transactionDate: "2024-01-01T00:00:00.000Z" },
    ]) {
      equal(updateTransactionSchema.safeParse(body).success, true);
    }
  });

  it("rejects empty, invalid and ownership-smuggling updates", () => {
    for (const body of [
      {},
      { userId: "other" },
      { id: "fixed" },
      { amount: "0" },
      { amount: "1.234" },
      { type: "TRANSFER" },
      { transactionDate: "nope" },
    ]) {
      equal(
        updateTransactionSchema.safeParse(body).success,
        false,
        `expected rejection: ${JSON.stringify(body)}`,
      );
    }
  });
});

describe("listTransactionsQuerySchema", () => {
  it("parses pagination, filters and a date range", () => {
    const parsed = listTransactionsQuerySchema.safeParse({
      page: "2",
      limit: "10",
      accountId: "account-1",
      categoryId: "category-1",
      type: "EXPENSE",
      from: "2024-01-01T00:00:00.000Z",
      to: "2024-02-01T00:00:00.000Z",
    });
    ok(parsed.success);
    equal(parsed.data.page, 2);
    equal(parsed.data.limit, 10);
    equal(parsed.data.type, "EXPENSE");
    equal(parsed.data.from?.toISOString(), "2024-01-01T00:00:00.000Z");
    equal(parsed.data.to?.toISOString(), "2024-02-01T00:00:00.000Z");
  });

  it("allows an empty query and TRANSFER as a read-only filter", () => {
    ok(listTransactionsQuerySchema.safeParse({}).success);
    const parsed = listTransactionsQuerySchema.safeParse({ type: "TRANSFER" });
    ok(parsed.success);
    equal(parsed.data.type, "TRANSFER");
  });

  it("rejects invalid pagination, dates and inverted ranges", () => {
    for (const query of [
      { page: "0" },
      { page: "abc" },
      { limit: "0" },
      { limit: "101" },
      { type: "OTHER" },
      { from: "not-a-date" },
      {
        from: "2024-02-01T00:00:00.000Z",
        to: "2024-01-01T00:00:00.000Z",
      },
    ]) {
      equal(
        listTransactionsQuerySchema.safeParse(query).success,
        false,
        `expected rejection: ${JSON.stringify(query)}`,
      );
    }
  });
});
