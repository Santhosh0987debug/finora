import {
  formatMoney,
  formatPercent,
  toFiniteAmount,
} from "../lib/format";
import { potProgressWidth } from "../lib/pots";
import type { DashboardPotSummary } from "../types/api";
import {
  ArrowRightIcon,
  CheckCircleIcon,
  PiggyBankIcon,
} from "./icons";

interface PotSnapshotProps {
  summary: DashboardPotSummary;
  onManage: () => void;
}

export function PotSnapshot({ summary, onManage }: PotSnapshotProps) {
  const saved = toFiniteAmount(summary.totalSaved);
  const target = toFiniteAmount(summary.totalTarget);
  const percentage = target > 0 ? (saved / target) * 100 : 0;
  const width = potProgressWidth(percentage);
  const inProgress = summary.count - summary.completedCount;

  return (
    <section className="rounded-3xl border border-stone-200 bg-white p-5 shadow-sm sm:p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold tracking-tight text-stone-950">
            Savings pots
          </h2>
          <p className="mt-1 text-sm text-stone-500">
            {summary.count > 0
              ? `${summary.count} goal${summary.count === 1 ? "" : "s"} · ${summary.completedCount} completed`
              : "No savings goals yet"}
          </p>
        </div>
        <button
          type="button"
          onClick={onManage}
          className="inline-flex shrink-0 items-center gap-1.5 self-start rounded-xl px-2.5 py-2 text-xs font-semibold text-emerald-700 transition hover:bg-emerald-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700"
        >
          Manage pots
          <ArrowRightIcon className="h-4 w-4" />
        </button>
      </div>

      {summary.count === 0 ? (
        <div className="mt-5 flex flex-col items-center justify-center rounded-2xl bg-stone-50 px-5 py-8 text-center">
          <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white text-stone-400 shadow-sm">
            <PiggyBankIcon className="h-6 w-6" />
          </span>
          <p className="mt-3 font-medium text-stone-700">
            Start saving toward a goal
          </p>
          <p className="mt-1 max-w-sm text-sm text-stone-500">
            Create a pot for an emergency fund, a trip, or anything else.
          </p>
          <button
            type="button"
            onClick={onManage}
            className="mt-4 inline-flex items-center gap-2 rounded-xl bg-emerald-700 px-3 py-2 text-xs font-semibold text-white transition hover:bg-emerald-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700"
          >
            Create a savings pot
            <ArrowRightIcon className="h-4 w-4" />
          </button>
        </div>
      ) : (
        <div className="mt-5">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-stone-400">
                Saved of total target
              </p>
              <p className="mt-1 text-2xl font-bold tracking-tight text-stone-950 tabular-nums">
                {formatMoney(summary.totalSaved)}{" "}
                <span className="text-sm font-medium text-stone-400">
                  of {formatMoney(summary.totalTarget)}
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
            aria-label="Combined savings pot progress"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(width)}
          >
            <div
              className="h-full rounded-full bg-gradient-to-r from-emerald-600 to-emerald-500"
              style={{ width: `${width}%` }}
            />
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700">
              <CheckCircleIcon className="h-3.5 w-3.5" />
              {summary.completedCount} completed
            </span>
            <span className="rounded-full bg-stone-100 px-2.5 py-1 text-xs font-semibold text-stone-600">
              {inProgress} in progress
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
