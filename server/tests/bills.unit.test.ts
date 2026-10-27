// Unit tests for Step 13 recurring bill helpers and validation.
// Run with: npm run test:unit --workspace=server
import { deepStrictEqual, equal, ok } from "node:assert";
import { describe, it } from "node:test";
import {
  Prisma,
  type BillFrequency,
  type BillStatus,
  type RecurringBill,
} from "@prisma/client";
import {
  daysUntilBillDue,
  effectiveBillStatus,
  sortBillsForDisplay,
  summarizeBills,
  toBillDto,
} from "../src/lib/bills.js";
import {
  createBillSchema,
  updateBillSchema,
  updateBillStatusSchema,
} from "../src/schemas/bills.js";

const now = new Date("2026-10-27T15:30:00.000Z");

function bill(
  overrides: Partial<RecurringBill> = {},
): RecurringBill {
  return {
    id: "bill-1",
    userId: "user-1",
    name: "Rent",
    amount: new Prisma.Decimal("1200.00"),
    dueDate: new Date("2026-10-27T00:00:00.000Z"),
    frequency: "MONTHLY" as BillFrequency,
    status: "UPCOMING" as BillStatus,
    createdAt: new Date("2026-10-01T10:00:00.000Z"),
    updatedAt: new Date("2026-10-02T10:00:00.000Z"),
    ...overrides,
  };
}

describe("toBillDto", () => {
  it("serializes money, date-only due date, status, and due distance", () => {
    const dto = toBillDto(
      bill({ dueDate: new Date("2026-11-01T00:00:00.000Z") }),
      now,
    );

    deepStrictEqual(dto, {
      id: "bill-1",
      name: "Rent",
      amount: "1200.00",
      frequency: "MONTHLY",
      dueDate: "2026-11-01",
      status: "UPCOMING",
      daysUntilDue: 5,
      createdAt: new Date("2026-10-01T10:00:00.000Z"),
      updatedAt: new Date("2026-10-02T10:00:00.000Z"),
    });
    equal("userId" in dto, false);
  });

  it("marks yesterday overdue and keeps paid bills paid", () => {
    equal(
      effectiveBillStatus(
        bill({ dueDate: new Date("2026-10-26T23:59:59.000Z") }),
        now,
      ),
      "OVERDUE",
    );
    equal(
      effectiveBillStatus(
        bill({
          dueDate: new Date("2026-10-20T00:00:00.000Z"),
          status: "PAID",
        }),
        now,
      ),
      "PAID",
    );
    equal(
      effectiveBillStatus(
        bill({ dueDate: new Date("2026-10-20T00:00:00.000Z") }),
        now,
      ),
      "OVERDUE",
    );
  });

  it("treats a bill due later today as upcoming, not overdue", () => {
    equal(
      effectiveBillStatus(
        bill({ dueDate: new Date("2026-10-27T23:59:59.000Z") }),
        now,
      ),
      "UPCOMING",
    );
    equal(
      daysUntilBillDue(new Date("2026-10-27T23:00:00.000Z"), now),
      0,
    );
    equal(
      daysUntilBillDue(new Date("2026-10-24T00:00:00.000Z"), now),
      -3,
    );
  });
});

describe("sortBillsForDisplay", () => {
  it("orders overdue, then upcoming, then paid bills", () => {
    const sorted = sortBillsForDisplay(
      [
        bill({
          id: "paid",
          name: "Internet",
          status: "PAID",
          dueDate: new Date("2026-11-05T00:00:00.000Z"),
        }),
        bill({
          id: "upcoming-later",
          name: "Insurance",
          dueDate: new Date("2026-11-10T00:00:00.000Z"),
        }),
        bill({
          id: "overdue-later",
          name: "Water",
          dueDate: new Date("2026-10-25T00:00:00.000Z"),
        }),
        bill({
          id: "overdue-sooner",
          name: "Electricity",
          dueDate: new Date("2026-10-24T00:00:00.000Z"),
        }),
        bill({
          id: "upcoming-sooner",
          name: "Phone",
          dueDate: new Date("2026-10-29T00:00:00.000Z"),
        }),
      ],
      now,
    );

    deepStrictEqual(
      sorted.map((entry) => entry.id),
      [
        "overdue-sooner",
        "overdue-later",
        "upcoming-sooner",
        "upcoming-later",
        "paid",
      ],
    );
  });

  it("lists paid bills by most recent due date first", () => {
    const sorted = sortBillsForDisplay(
      [
        bill({
          id: "older",
          status: "PAID",
          dueDate: new Date("2026-09-01T00:00:00.000Z"),
        }),
        bill({
          id: "newer",
          status: "PAID",
          dueDate: new Date("2026-10-01T00:00:00.000Z"),
        }),
      ],
      now,
    );
    deepStrictEqual(
      sorted.map((entry) => entry.id),
      ["newer", "older"],
    );
  });
});

describe("summarizeBills", () => {
  it("counts statuses and totals only unpaid bills", () => {
    const summary = summarizeBills(
      [
        bill({
          id: "overdue",
          amount: new Prisma.Decimal("1200.00"),
          dueDate: new Date("2026-10-24T00:00:00.000Z"),
        }),
        bill({
          id: "upcoming",
          amount: new Prisma.Decimal("80.00"),
          dueDate: new Date("2026-11-01T00:00:00.000Z"),
        }),
        bill({
          id: "paid",
          amount: new Prisma.Decimal("20.00"),
          status: "PAID",
          dueDate: new Date("2026-10-26T00:00:00.000Z"),
        }),
        bill({
          id: "paid-past",
          amount: new Prisma.Decimal("50.00"),
          status: "PAID",
          dueDate: new Date("2026-10-10T00:00:00.000Z"),
        }),
      ],
      now,
    );

    deepStrictEqual(summary, {
      count: 4,
      overdueCount: 1,
      upcomingCount: 1,
      paidCount: 2,
      totalDue: "1280.00",
      overdueAmount: "1200.00",
      nextDue: {
        id: "overdue",
        name: "Rent",
        amount: "1200.00",
        dueDate: "2026-10-24",
        status: "OVERDUE",
      },
    });
  });

  it("returns a zero summary for no bills", () => {
    deepStrictEqual(summarizeBills([], now), {
      count: 0,
      overdueCount: 0,
      upcomingCount: 0,
      paidCount: 0,
      totalDue: "0.00",
      overdueAmount: "0.00",
      nextDue: null,
    });
  });
});

describe("recurring bill schemas", () => {
  it("accepts valid payloads and normalizes the due date", () => {
    const created = createBillSchema.safeParse({
      name: "  Rent  ",
      amount: "1200",
      frequency: "MONTHLY",
      dueDate: "2028-02-29",
    });
    equal(created.success, true);
    if (created.success) {
      equal(created.data.name, "Rent");
      equal(created.data.amount, "1200");
      equal(created.data.dueDate.toISOString(), "2028-02-29T00:00:00.000Z");
    }

    equal(
      createBillSchema.safeParse({
        name: "Internet",
        amount: 80,
        frequency: "QUARTERLY",
        dueDate: "2026-12-01",
        status: "PAID",
      }).success,
      true,
    );
    equal(updateBillSchema.safeParse({ name: "Renamed" }).success, true);
    equal(
      updateBillStatusSchema.safeParse({ status: "PAID" }).success,
      true,
    );
  });

  it("rejects invalid names, amounts, frequencies, and dates", () => {
    const base = {
      name: "Rent",
      amount: "1200.00",
      frequency: "MONTHLY",
      dueDate: "2026-11-01",
    };
    equal(createBillSchema.safeParse({ ...base, name: " " }).success, false);
    equal(createBillSchema.safeParse({ ...base, amount: "0" }).success, false);
    equal(createBillSchema.safeParse({ ...base, amount: "-5" }).success, false);
    equal(
      createBillSchema.safeParse({ ...base, amount: "10.001" }).success,
      false,
    );
    equal(
      createBillSchema.safeParse({ ...base, frequency: "DAILY" }).success,
      false,
    );
    equal(
      createBillSchema.safeParse({ ...base, dueDate: "2026-02-30" }).success,
      false,
    );
    equal(
      createBillSchema.safeParse({ ...base, dueDate: "11/01/2026" }).success,
      false,
    );
  });

  it("rejects derived statuses and ownership fields", () => {
    const base = {
      name: "Rent",
      amount: "1200.00",
      frequency: "MONTHLY",
      dueDate: "2026-11-01",
    };
    equal(
      createBillSchema.safeParse({ ...base, status: "OVERDUE" }).success,
      false,
    );
    equal(
      createBillSchema.safeParse({ ...base, userId: "attacker" }).success,
      false,
    );
    equal(
      updateBillStatusSchema.safeParse({ status: "OVERDUE" }).success,
      false,
    );
    equal(updateBillSchema.safeParse({}).success, false);
    ok(updateBillSchema.safeParse({ name: "Insurance" }).success);
  });
});
