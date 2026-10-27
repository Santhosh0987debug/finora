// Calendar-month helpers. Dates are stored and returned as UTC instants, so
// month boundaries are calculated in UTC as well. This keeps summaries stable
// regardless of the host server's local timezone.

export type MonthBucket = {
  month: string;
  start: Date;
  end: Date;
};

export function startOfUtcMonth(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
}

export function addUtcMonths(date: Date, months: number): Date {
  return new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + months, 1),
  );
}

export function utcMonthKey(date: Date): string {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(
    2,
    "0",
  )}`;
}

// Returns `count` consecutive month buckets, oldest first, ending with the
// month containing `reference`. Each bucket is a half-open UTC range:
// [start, end).
export function buildMonthBuckets(
  reference: Date,
  count = 6,
): MonthBucket[] {
  if (!Number.isInteger(count) || count < 1) {
    throw new Error("count must be a positive integer");
  }

  const currentStart = startOfUtcMonth(reference);
  const firstStart = addUtcMonths(currentStart, -(count - 1));

  return Array.from({ length: count }, (_, index) => {
    const start = addUtcMonths(firstStart, index);
    const end = addUtcMonths(firstStart, index + 1);
    return { month: utcMonthKey(start), start, end };
  });
}
