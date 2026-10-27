// Unit tests for Step 5 account validation (no database access).
// Run with: npm run test:unit --workspace=server
import { deepStrictEqual, equal, ok } from "node:assert";
import { describe, it } from "node:test";
import {
  createAccountSchema,
  moneySchema,
  updateAccountSchema,
} from "../src/schemas/accounts.js";

describe("moneySchema", () => {
  it("accepts numbers and decimal strings, normalizing to strings", () => {
    deepStrictEqual(
      [
        moneySchema.safeParse(100),
        moneySchema.safeParse(100.5),
        moneySchema.safeParse(0),
        moneySchema.safeParse(-25.75),
        moneySchema.safeParse("100.50"),
        moneySchema.safeParse("  12.50  "),
      ].map((r) => (r.success ? r.data : null)),
      ["100", "100.5", "0", "-25.75", "100.50", "12.50"],
    );
  });

  it("rejects non-finite values, float artifacts and >2 decimals", () => {
    for (const value of [
      Number.NaN,
      Number.POSITIVE_INFINITY,
      0.30000000000000004,
      10.001,
      "10.001",
      "1e3",
      "abc",
      "",
      "   ",
      10_000_000_000,
      "-10000000000",
      "9999999999.999",
    ]) {
      const parsed = moneySchema.safeParse(value);
      equal(parsed.success, false, `expected rejection: ${String(value)}`);
    }
    ok(true);
  });
});

describe("createAccountSchema", () => {
  it("accepts a minimal body and the full body", () => {
    const minimal = createAccountSchema.safeParse({
      name: "Everyday",
      type: "CHECKING",
    });
    ok(minimal.success);
    deepStrictEqual(minimal.data, {
      name: "Everyday",
      type: "CHECKING",
    });

    const full = createAccountSchema.safeParse({
      name: "  Vault ",
      type: "SAVINGS",
      balance: "1250.50",
      currency: "eur",
    });
    ok(full.success);
    deepStrictEqual(full.data, {
      name: "Vault",
      type: "SAVINGS",
      balance: "1250.50",
      currency: "EUR",
    });
  });

  it("rejects bad types, money, currency and smuggled ownership fields", () => {
    for (const body of [
      { name: "X", type: "CHEQUING" },
      { name: "X", type: "CHECKING", balance: "10.001" },
      { name: "X", type: "CHECKING", currency: "US" },
      { name: "X", type: "CHECKING", currency: "USDD" },
      { name: "", type: "CHECKING" },
      { name: "X", type: "CHECKING", userId: "someone-else" },
      { name: "X", type: "CHECKING", id: "fixed-id" },
      { type: "CHECKING" },
    ]) {
      equal(
        createAccountSchema.safeParse(body).success,
        false,
        `expected rejection: ${JSON.stringify(body)}`,
      );
    }
    ok(true);
  });
});

describe("updateAccountSchema", () => {
  it("accepts partial updates and rejects empty or smuggled bodies", () => {
    ok(
      updateAccountSchema.safeParse({ name: "Renamed", balance: 42 }).success,
    );
    for (const body of [{}, { userId: "someone-else" }, { id: "x" }, { balance: "1.234" }]) {
      equal(
        updateAccountSchema.safeParse(body).success,
        false,
        `expected rejection: ${JSON.stringify(body)}`,
      );
    }
    ok(true);
  });
});
