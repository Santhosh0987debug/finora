// Unit tests for Step 7 dashboard calendar helpers (no database access).
// Run with: npm run test:unit --workspace=server
import { deepStrictEqual, equal, throws } from "node:assert";
import { describe, it } from "node:test";
import {
  addUtcMonths,
  buildMonthBuckets,
  startOfUtcMonth,
  utcMonthKey,
} from "../src/lib/monthRanges.js";

describe("startOfUtcMonth", () => {
  it("uses the UTC month even at local-time boundaries", () => {
    deepStrictEqual(
      startOfUtcMonth(new Date("2026-03-01T00:00:00.000Z")),
      new Date("2026-03-01T00:00:00.000Z"),
    );
    deepStrictEqual(
      startOfUtcMonth(new Date("2026-03-31T23:59:59.999Z")),
      new Date("2026-03-01T00:00:00.000Z"),
    );
    deepStrictEqual(
      startOfUtcMonth(new Date("2026-02-28T23:59:59.999Z")),
      new Date("2026-02-01T00:00:00.000Z"),
    );
  });
});

describe("addUtcMonths and utcMonthKey", () => {
  it("rolls across year boundaries and pads month numbers", () => {
    const january = new Date("2026-01-15T12:00:00.000Z");
    deepStrictEqual(addUtcMonths(january, -5), new Date("2025-08-01T00:00:00.000Z"));
    deepStrictEqual(addUtcMonths(january, 1), new Date("2026-02-01T00:00:00.000Z"));
    deepStrictEqual(addUtcMonths(january, 12), new Date("2027-01-01T00:00:00.000Z"));

    equal(utcMonthKey(new Date("2025-08-01T00:00:00.000Z")), "2025-08");
    equal(utcMonthKey(new Date("2026-10-26T00:00:00.000Z")), "2026-10");
    equal(utcMonthKey(new Date("2026-12-31T23:59:59.999Z")), "2026-12");
  });
});

describe("buildMonthBuckets", () => {
  it("returns six chronological UTC buckets ending with the current month", () => {
    const buckets = buildMonthBuckets(new Date("2026-10-26T18:30:00.000Z"), 6);
    deepStrictEqual(
      buckets.map((bucket) => bucket.month),
      ["2026-05", "2026-06", "2026-07", "2026-08", "2026-09", "2026-10"],
    );
    deepStrictEqual(buckets[0].start, new Date("2026-05-01T00:00:00.000Z"));
    deepStrictEqual(buckets[5].start, new Date("2026-10-01T00:00:00.000Z"));
    deepStrictEqual(buckets[5].end, new Date("2026-11-01T00:00:00.000Z"));

    for (let index = 1; index < buckets.length; index += 1) {
      deepStrictEqual(buckets[index].start, buckets[index - 1].end);
    }
  });

  it("handles a January reference and a December reference", () => {
    deepStrictEqual(
      buildMonthBuckets(new Date("2026-01-15T00:00:00.000Z"), 6).map(
        (bucket) => bucket.month,
      ),
      ["2025-08", "2025-09", "2025-10", "2025-11", "2025-12", "2026-01"],
    );
    deepStrictEqual(
      buildMonthBuckets(new Date("2025-12-15T00:00:00.000Z"), 6).map(
        (bucket) => bucket.month,
      ),
      ["2025-07", "2025-08", "2025-09", "2025-10", "2025-11", "2025-12"],
    );
  });

  it("uses half-open ranges and rejects invalid bucket counts", () => {
    const buckets = buildMonthBuckets(new Date("2026-03-15T00:00:00.000Z"), 1);
    deepStrictEqual(buckets, [
      {
        month: "2026-03",
        start: new Date("2026-03-01T00:00:00.000Z"),
        end: new Date("2026-04-01T00:00:00.000Z"),
      },
    ]);
    throws(() => buildMonthBuckets(new Date(), 0), /positive integer/);
    throws(() => buildMonthBuckets(new Date(), 1.5), /positive integer/);
  });
});
