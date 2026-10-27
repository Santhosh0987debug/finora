import { formatMoney, formatPercent, toFiniteAmount } from "../lib/format";
import { budgetStatusForAmounts } from "../lib/budgets";
import type { BudgetRecord } from "../types/api";
import {
  AlertIcon,
  TargetIcon,
  TrendDownIcon,
  WalletIcon,
} from "./icons";

interface BudgetSummaryCardsProps {
  budgets: BudgetRecord[];
}

export function BudgetSummaryCards({ budgets }: BudgetSummaryCardsProps) {
  const totalLimit = budgets.reduce(
    (sum, budget) => sum + toFiniteAmount(budget.amount),
    0,
  );
  const totalSpent = budgets.reduce(
    (sum, budget) => sum + toFiniteAmount(budget.spent),
    0,
  );
  const remaining = totalLimit - totalSpent;
  const percentage =
    totalLimit > 0 ? (totalSpent / totalLimit) * 100 : 0;
  const status = budgetStatusForAmounts(totalLimit, totalSpent);
  const remainingTone =
    status === "OVER" ? "text-rose-700" : "text-stone-950";

  return (
    <div className="grid gap-4 sm:grid-cols-3">
      <article className="rounded-3xl border border-stone-200 bg-white p-5 shadow-sm">
        <div className="flex items-start justify-between gap-4">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-stone-500">
            Total limit
          </p>
          <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700">
            <TargetIcon className="h-5 w-5" />
          </span>
        </div>
        <p className="mt-5 text-3xl font-bold tracking-tight tabular-nums text-stone-950">
          {formatMoney(totalLimit)}
        </p>
        <p className="mt-2 text-sm text-stone-500">
          {budgets.length} budget{budgets.length === 1 ? "" : "s"} in this period
        </p>
      </article>

      <article className="rounded-3xl border border-stone-200 bg-white p-5 shadow-sm">
        <div className="flex items-start justify-between gap-4">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-stone-500">
            Current spending
          </p>
          <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-rose-50 text-rose-700">
            <TrendDownIcon className="h-5 w-5" />
          </span>
        </div>
        <p className="mt-5 text-3xl font-bold tracking-tight tabular-nums text-rose-700">
          {formatMoney(totalSpent)}
        </p>
        <p className="mt-2 text-sm text-stone-500">
          {formatPercent(percentage)} of total limits
        </p>
      </article>

      <article className="rounded-3xl border border-stone-200 bg-white p-5 shadow-sm">
        <div className="flex items-start justify-between gap-4">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-stone-500">
            Remaining
          </p>
          <span
            className={`flex h-10 w-10 items-center justify-center rounded-2xl ${
              status === "OVER"
                ? "bg-rose-50 text-rose-700"
                : status === "APPROACHING"
                  ? "bg-amber-50 text-amber-700"
                  : "bg-stone-100 text-stone-600"
            }`}
          >
            {status === "OVER" ? (
              <AlertIcon className="h-5 w-5" />
            ) : (
              <WalletIcon className="h-5 w-5" />
            )}
          </span>
        </div>
        <p
          className={`mt-5 text-3xl font-bold tracking-tight tabular-nums ${remainingTone}`}
        >
          {formatMoney(remaining)}
        </p>
        <p className="mt-2 text-sm text-stone-500">
          {status === "OVER"
            ? "Combined budgets are over their limit"
            : status === "APPROACHING"
              ? "Combined limits are nearly used"
              : "Across all budgets in this period"}
        </p>
      </article>
    </div>
  );
}
