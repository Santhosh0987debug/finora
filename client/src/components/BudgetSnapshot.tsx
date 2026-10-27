import {
  formatMoney,
  formatMonthLong,
  formatPercent,
  toFiniteAmount,
} from "../lib/format";
import { budgetStatusForAmounts, budgetProgressWidth } from "../lib/budgets";
import type { DashboardBudgetSummary } from "../types/api";
import { ArrowRightIcon, TargetIcon } from "./icons";

interface BudgetSnapshotProps {
  summary: DashboardBudgetSummary;
  onManage: () => void;
}

const statusStyles = {
  UNDER: "bg-emerald-600",
  APPROACHING: "bg-amber-500",
  OVER: "bg-rose-600",
} as const;

export function BudgetSnapshot({ summary, onManage }: BudgetSnapshotProps) {
  const limit = toFiniteAmount(summary.totalLimit);
  const spent = toFiniteAmount(summary.totalSpent);
  const percentage = limit > 0 ? (spent / limit) * 100 : 0;
  const status = budgetStatusForAmounts(summary.totalLimit, summary.totalSpent);
  const width = budgetProgressWidth(percentage);

  return (
    <section className="rounded-3xl border border-stone-200 bg-white p-5 shadow-sm sm:p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold tracking-tight text-stone-950">
            Budgets this month
          </h2>
          <p className="mt-1 text-sm text-stone-500">
            {summary.count > 0
              ? `${formatMonthLong(summary.month)} · ${summary.count} budget${summary.count === 1 ? "" : "s"}`
              : `${formatMonthLong(summary.month)} · No budgets set`}
          </p>
        </div>
        <button
          type="button"
          onClick={onManage}
          className="inline-flex shrink-0 items-center gap-1.5 self-start rounded-xl px-2.5 py-2 text-xs font-semibold text-emerald-700 transition hover:bg-emerald-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700"
        >
          Manage budgets
          <ArrowRightIcon className="h-4 w-4" />
        </button>
      </div>

      {summary.count === 0 ? (
        <div className="mt-5 flex flex-col items-center justify-center rounded-2xl bg-stone-50 px-5 py-8 text-center">
          <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white text-stone-400 shadow-sm">
            <TargetIcon className="h-6 w-6" />
          </span>
          <p className="mt-3 font-medium text-stone-700">
            No budgets for this month
          </p>
          <p className="mt-1 max-w-sm text-sm text-stone-500">
            Set category limits to track spending against your monthly goals.
          </p>
          <button
            type="button"
            onClick={onManage}
            className="mt-4 inline-flex items-center gap-2 rounded-xl bg-emerald-700 px-3 py-2 text-xs font-semibold text-white transition hover:bg-emerald-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700"
          >
            Create a budget
            <ArrowRightIcon className="h-4 w-4" />
          </button>
        </div>
      ) : (
        <div className="mt-5">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-stone-400">
                Spent of total limit
              </p>
              <p className="mt-1 text-2xl font-bold tracking-tight text-stone-950 tabular-nums">
                {formatMoney(summary.totalSpent)}{" "}
                <span className="text-sm font-medium text-stone-400">
                  of {formatMoney(summary.totalLimit)}
                </span>
              </p>
            </div>
            <p className="text-sm font-semibold tabular-nums text-stone-600">
              {formatPercent(percentage)}
            </p>
          </div>

          <div
            className="mt-3 h-2.5 overflow-hidden rounded-full bg-stone-100"
            role="progressbar"
            aria-label="Combined budget usage"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(width)}
          >
            <div
              className={`h-full rounded-full ${statusStyles[status]}`}
              style={{ width: `${width}%` }}
            />
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700">
              {summary.underCount} under
            </span>
            <span className="rounded-full bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-700">
              {summary.approachingCount} approaching
            </span>
            <span className="rounded-full bg-rose-50 px-2.5 py-1 text-xs font-semibold text-rose-700">
              {summary.overCount} over
            </span>
            <span className="ml-auto text-sm text-stone-500">
              {formatMoney(summary.totalRemaining)} remaining
            </span>
          </div>
        </div>
      )}
    </section>
  );
}
