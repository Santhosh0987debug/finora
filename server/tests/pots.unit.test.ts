// Unit tests for Step 12 savings pot helpers and validation (no database access).
// Run with: npm run test:unit --workspace=server
import { deepStrictEqual, equal, ok } from "node:assert";
import { describe, it } from "node:test";
import { Prisma, type Pot } from "@prisma/client";
import {
  summarizePots,
  toPotDto,
} from "../src/lib/pots.js";
import {
  createPotSchema,
  potMovementSchema,
  updatePotSchema,
} from "../src/schemas/pots.js";

function decimal(value: string): Prisma.Decimal {
  return new Prisma.Decimal(value);
}

function pot(
  targetAmount: string,
  currentAmount: string,
  targetDate: Date | null = null,
): Pot {
  return {
    id: "pot-1",
    userId: "user-1",
    name: "Emergency fund",
    targetAmount: decimal(targetAmount),
    currentAmount: decimal(currentAmount),
    targetDate,
    theme: null,
    createdAt: new Date("2026-10-01T00:00:00.000Z"),
    updatedAt: new Date("2026-10-02T00:00:00.000Z"),
  };
}

describe("toPotDto", () => {
  it("serializes money, date-only target, progress, and completion", () => {
    const dto = toPotDto(
      pot("1000.00", "250.50", new Date("2026-12-31T00:00:00.000Z")),
    );

    deepStrictEqual(dto, {
      id: "pot-1",
      name: "Emergency fund",
      targetAmount: "1000.00",
      currentAmount: "250.50",
      targetDate: "2026-12-31",
      remaining: "749.50",
      percentage: 25.05,
      isComplete: false,
      createdAt: new Date("2026-10-01T00:00:00.000Z"),
      updatedAt: new Date("2026-10-02T00:00:00.000Z"),
    });
    equal("userId" in dto, false);
    equal("theme" in dto, false);
  });

  it("marks a fully funded pot complete and supports no target date", () => {
    const dto = toPotDto(pot("100.00", "100.00"));
    equal(dto.remaining, "0.00");
    equal(dto.percentage, 100);
    equal(dto.isComplete, true);
    equal(dto.targetDate, null);
  });

  it("rounds percentages to two decimals and never shows negative remaining", () => {
    const dto = toPotDto(pot("3.00", "1.00"));
    equal(dto.percentage, 33.33);

    const overfunded = toPotDto(pot("100.00", "125.00"));
    equal(overfunded.remaining, "0.00");
    equal(overfunded.percentage, 125);
    equal(overfunded.isComplete, true);
  });
});

describe("summarizePots", () => {
  it("totals saved and target amounts and counts completed goals", () => {
    const summary = summarizePots([
      pot("100.00", "100.00"),
      pot("250.00", "50.00"),
      pot("50.00", "50.00"),
    ]);

    deepStrictEqual(summary, {
      count: 3,
      totalSaved: "200.00",
      totalTarget: "400.00",
      totalRemaining: "200.00",
      completedCount: 2,
      percentage: 50,
    });
  });

  it("returns a zero summary for no pots", () => {
    deepStrictEqual(summarizePots([]), {
      count: 0,
      totalSaved: "0.00",
      totalTarget: "0.00",
      totalRemaining: "0.00",
      completedCount: 0,
      percentage: 0,
    });
  });
});

describe("savings pot schemas", () => {
  it("accepts valid create and update payloads with a leap-day target", () => {
    const created = createPotSchema.safeParse({
      name: "  New laptop  ",
      targetAmount: "1500",
      currentAmount: "0",
      targetDate: "2028-02-29",
    });
    equal(created.success, true);
    if (created.success) {
      equal(created.data.name, "New laptop");
      equal(created.data.targetDate?.toISOString(), "2028-02-29T00:00:00.000Z");
    }

    equal(updatePotSchema.safeParse({ name: "Renamed" }).success, true);
    equal(updatePotSchema.safeParse({ targetDate: null }).success, true);
  });

  it("rejects non-positive targets, negative saved amounts, and bad dates", () => {
    const base = {
      name: "Trip",
      targetAmount: "1000.00",
    };
    equal(
      createPotSchema.safeParse({ ...base, targetAmount: "0" }).success,
      false,
    );
    equal(
      createPotSchema.safeParse({ ...base, targetAmount: "-1" }).success,
      false,
    );
    equal(
      createPotSchema.safeParse({ ...base, currentAmount: "-0.01" }).success,
      false,
    );
    for (const targetDate of [
      "2026-02-29",
      "2026-13-01",
      "2026-12-31T00:00:00Z",
      "12/31/2026",
    ]) {
      equal(
        createPotSchema.safeParse({ ...base, targetDate }).success,
        false,
        targetDate,
      );
    }
  });

  it("rejects empty updates, zero movements, and unknown fields", () => {
    equal(updatePotSchema.safeParse({}).success, false);
    equal(potMovementSchema.safeParse({ amount: "0" }).success, false);
    equal(potMovementSchema.safeParse({ amount: "-5" }).success, false);
    equal(potMovementSchema.safeParse({ amount: "10.00" }).success, true);

    const parsed = createPotSchema.safeParse({
      name: "Trip",
      targetAmount: "1000.00",
      userId: "attacker",
    });
    equal(parsed.success, false);
    if (!parsed.success) {
      ok(
        parsed.error.issues.some(
          (issue) => issue.code === "unrecognized_keys",
        ),
      );
    }
  });
});
