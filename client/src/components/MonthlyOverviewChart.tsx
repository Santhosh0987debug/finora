import {
  formatMoney,
  formatMonthLong,
  formatMonthShort,
  toFiniteAmount,
} from "../lib/format";
import type { MonthlyOverviewPoint } from "../types/api";

interface MonthlyOverviewChartProps {
  data: MonthlyOverviewPoint[];
}

export function MonthlyOverviewChart({ data }: MonthlyOverviewChartProps) {
  const maxValue = Math.max(
    0,
    ...data.flatMap((point) => [
      toFiniteAmount(point.income),
      toFiniteAmount(point.expenses),
    ]),
  );
  const hasActivity = maxValue > 0;

  const barHeight = (value: string): string => {
    const amount = toFiniteAmount(value);
    if (amount <= 0 || maxValue <= 0) {
      return "0%";
    }
    return `${Math.max((amount / maxValue) * 100, 4)}%`;
  };

  return (
    <section className="flex h-full flex-col rounded-3xl border border-stone-200 bg-white p-5 shadow-sm sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold tracking-tight text-stone-950">
            Six-month overview
          </h2>
          <p className="mt-1 text-sm text-stone-500">
            Income compared with expenses
          </p>
        </div>
        <div className="flex items-center gap-4 text-xs font-medium text-stone-600">
          <span className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
            Income
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-rose-400" />
            Expenses
          </span>
        </div>
      </div>

      <div className="relative mt-8 flex-1">
        <div
          className="pointer-events-none absolute inset-x-0 top-0 h-48 sm:h-56"
          aria-hidden="true"
        >
          <div className="absolute inset-x-0 top-0 border-t border-dashed border-stone-100" />
          <div className="absolute inset-x-0 top-1/4 border-t border-dashed border-stone-100" />
          <div className="absolute inset-x-0 top-1/2 border-t border-dashed border-stone-100" />
          <div className="absolute inset-x-0 top-3/4 border-t border-dashed border-stone-100" />
          <div className="absolute inset-x-0 bottom-0 border-t border-stone-200" />
        </div>

        <div className="relative grid grid-cols-6 gap-2 sm:gap-4">
          {data.map((point) => (
            <div key={point.month} className="min-w-0">
              <div className="flex h-48 items-end justify-center gap-1.5 sm:h-56 sm:gap-2">
                <div
                  className="w-full max-w-3 rounded-t-md bg-emerald-500 transition-colors hover:bg-emerald-600 sm:max-w-4"
                  style={{ height: barHeight(point.income) }}
                  title={`${formatMonthLong(point.month)} income: ${formatMoney(point.income)}`}
                  aria-hidden="true"
                />
                <div
                  className="w-full max-w-3 rounded-t-md bg-rose-400 transition-colors hover:bg-rose-500 sm:max-w-4"
                  style={{ height: barHeight(point.expenses) }}
                  title={`${formatMonthLong(point.month)} expenses: ${formatMoney(point.expenses)}`}
                  aria-hidden="true"
                />
              </div>
              <p className="mt-3 truncate text-center text-xs font-medium text-stone-500">
                {formatMonthShort(point.month)}
              </p>
              <p className="sr-only">
                {formatMonthLong(point.month)}: income{" "}
                {formatMoney(point.income)}, expenses{" "}
                {formatMoney(point.expenses)}.
              </p>
            </div>
          ))}
        </div>

        {!hasActivity && (
          <div className="pointer-events-none absolute inset-x-0 top-0 flex h-48 items-center justify-center sm:h-56">
            <p className="rounded-full border border-stone-200 bg-white/95 px-4 py-2 text-center text-sm text-stone-500 shadow-sm">
              No activity in the last six months.
            </p>
          </div>
        )}
      </div>
    </section>
  );
}
