import { formatMoney, formatPercent, toFiniteAmount } from "../lib/format";
import type { ExpenseBreakdownItem } from "../types/api";
import { PieChartIcon } from "./icons";

interface ExpenseBreakdownProps {
  data: ExpenseBreakdownItem[];
  totalExpenses: string;
}

const SEGMENT_COLORS = [
  "#047857",
  "#f59e0b",
  "#0ea5e9",
  "#f43f5e",
  "#8b5cf6",
  "#14b8a6",
  "#d97706",
  "#64748b",
];

export function ExpenseBreakdown({
  data,
  totalExpenses,
}: ExpenseBreakdownProps) {
  const total = data.reduce(
    (sum, item) => sum + toFiniteAmount(item.amount),
    0,
  );

  let cursor = 0;
  const gradient =
    total > 0
      ? data
          .map((item, index) => {
            const start = cursor;
            cursor += (toFiniteAmount(item.amount) / total) * 100;
            const end = index === data.length - 1 ? 100 : cursor;
            return `${SEGMENT_COLORS[index % SEGMENT_COLORS.length]} ${start.toFixed(2)}% ${end.toFixed(2)}%`;
          })
          .join(", ")
      : "#e7e5e4 0% 100%";

  return (
    <section className="flex h-full flex-col rounded-3xl border border-stone-200 bg-white p-5 shadow-sm sm:p-6">
      <div>
        <h2 className="text-lg font-semibold tracking-tight text-stone-950">
          Expense breakdown
        </h2>
        <p className="mt-1 text-sm text-stone-500">This month by category</p>
      </div>

      {data.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center py-12 text-center">
          <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-stone-100 text-stone-400">
            <PieChartIcon className="h-6 w-6" />
          </span>
          <p className="mt-4 font-medium text-stone-700">No expenses yet</p>
          <p className="mt-1 max-w-56 text-sm text-stone-500">
            Spending categories will appear here once you record an expense.
          </p>
        </div>
      ) : (
        <>
          <div className="mt-6 flex justify-center">
            <div
              className="relative h-40 w-40 rounded-full"
              style={{
                background: `conic-gradient(from -90deg, ${gradient})`,
              }}
              role="img"
              aria-label={`Expense breakdown for ${formatMoney(totalExpenses)} this month`}
            >
              <div className="absolute inset-[18px] flex flex-col items-center justify-center rounded-full bg-white text-center">
                <span className="text-xs font-medium uppercase tracking-[0.14em] text-stone-400">
                  Spent
                </span>
                <span className="mt-1 text-base font-bold tracking-tight text-stone-900 tabular-nums">
                  {formatMoney(totalExpenses)}
                </span>
              </div>
            </div>
          </div>

          <ul className="mt-6 space-y-4">
            {data.map((item, index) => {
              const color = SEGMENT_COLORS[index % SEGMENT_COLORS.length];
              const name = item.categoryName.trim() || "Uncategorized";
              const width = Math.min(100, Math.max(0, item.percentage));
              return (
                <li key={`${item.categoryId ?? "uncategorized"}-${index}`}>
                  <div className="flex items-center justify-between gap-3 text-sm">
                    <span className="flex min-w-0 items-center gap-2 font-medium text-stone-700">
                      <span
                        className="h-2.5 w-2.5 shrink-0 rounded-full"
                        style={{ backgroundColor: color }}
                      />
                      <span className="truncate">{name}</span>
                    </span>
                    <span className="shrink-0 tabular-nums text-stone-900">
                      {formatMoney(item.amount)}
                    </span>
                  </div>
                  <div className="mt-2 flex items-center gap-3">
                    <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-stone-100">
                      <div
                        className="h-full rounded-full"
                        style={{ width: `${width}%`, backgroundColor: color }}
                      />
                    </div>
                    <span className="w-12 shrink-0 text-right text-xs tabular-nums text-stone-500">
                      {formatPercent(item.percentage)}
                    </span>
                  </div>
                </li>
              );
            })}
          </ul>
        </>
      )}
    </section>
  );
}
