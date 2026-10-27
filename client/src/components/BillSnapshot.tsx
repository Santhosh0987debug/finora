import type { DashboardBillSummary } from "../types/api";
import { formatBillDueDate } from "../lib/bills";
import { formatMoney } from "../lib/format";
import {
  AlertIcon,
  ArrowRightIcon,
  BellIcon,
  CalendarIcon,
  CheckCircleIcon,
} from "./icons";

interface BillSnapshotProps {
  summary: DashboardBillSummary;
  onManage: () => void;
}

export function BillSnapshot({ summary, onManage }: BillSnapshotProps) {
  const nextDue = summary.nextDue;

  return (
    <section className="rounded-3xl border border-stone-200 bg-white p-5 shadow-sm sm:p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold tracking-tight text-stone-950">
            Recurring bills
          </h2>
          <p className="mt-1 text-sm text-stone-500">
            {summary.count > 0
              ? `${summary.count} bill${summary.count === 1 ? "" : "s"} on your schedule`
              : "No recurring bills yet"}
          </p>
        </div>
        <button
          type="button"
          onClick={onManage}
          className="inline-flex shrink-0 items-center gap-1.5 self-start rounded-xl px-2.5 py-2 text-xs font-semibold text-emerald-700 transition hover:bg-emerald-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700"
        >
          Manage bills
          <ArrowRightIcon className="h-4 w-4" />
        </button>
      </div>

      {summary.count === 0 ? (
        <div className="mt-5 flex flex-col items-center justify-center rounded-2xl bg-stone-50 px-5 py-8 text-center">
          <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white text-stone-400 shadow-sm">
            <BellIcon className="h-6 w-6" />
          </span>
          <p className="mt-3 font-medium text-stone-700">
            Stay ahead of due dates
          </p>
          <p className="mt-1 max-w-sm text-sm text-stone-500">
            Add rent, subscriptions, and other repeating bills to see what is
            coming up.
          </p>
          <button
            type="button"
            onClick={onManage}
            className="mt-4 inline-flex items-center gap-2 rounded-xl bg-emerald-700 px-3 py-2 text-xs font-semibold text-white transition hover:bg-emerald-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700"
          >
            Add your first bill
            <ArrowRightIcon className="h-4 w-4" />
          </button>
        </div>
      ) : (
        <div className="mt-5">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-stone-400">
                Unpaid total
              </p>
              <p className="mt-1 text-2xl font-bold tracking-tight text-stone-950 tabular-nums">
                {formatMoney(summary.totalDue)}
              </p>
            </div>
            {summary.overdueCount > 0 && (
              <p className="inline-flex items-center gap-1.5 self-start rounded-full bg-rose-50 px-2.5 py-1 text-xs font-semibold text-rose-700 sm:self-auto">
                <AlertIcon className="h-3.5 w-3.5" />
                {formatMoney(summary.overdueAmount)} overdue
              </p>
            )}
          </div>

          {nextDue && (
            <div className="mt-4 rounded-2xl border border-stone-100 bg-stone-50 px-4 py-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-stone-400">
                    {nextDue.status === "OVERDUE"
                      ? "Overdue"
                      : "Next due"}
                  </p>
                  <p className="mt-1 truncate font-semibold text-stone-900">
                    {nextDue.name}
                  </p>
                  <p
                    className={`mt-1 inline-flex items-center gap-1.5 text-xs ${
                      nextDue.status === "OVERDUE"
                        ? "text-rose-700"
                        : "text-stone-500"
                    }`}
                  >
                    <CalendarIcon className="h-3.5 w-3.5" />
                    {nextDue.status === "OVERDUE" ? "Was due" : "Due"}{" "}
                    {formatBillDueDate(nextDue.dueDate)}
                  </p>
                </div>
                <p className="shrink-0 text-sm font-bold tabular-nums text-stone-950">
                  {formatMoney(nextDue.amount)}
                </p>
              </div>
            </div>
          )}

          <div className="mt-4 flex flex-wrap items-center gap-2">
            {summary.overdueCount > 0 && (
              <span className="inline-flex items-center gap-1 rounded-full bg-rose-50 px-2.5 py-1 text-xs font-semibold text-rose-700">
                <AlertIcon className="h-3.5 w-3.5" />
                {summary.overdueCount} overdue
              </span>
            )}
            <span className="rounded-full bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-800">
              {summary.upcomingCount} upcoming
            </span>
            <span className="ml-auto inline-flex items-center gap-1 text-xs text-stone-500">
              <CheckCircleIcon className="h-3.5 w-3.5 text-emerald-600" />
              {summary.paidCount} paid
            </span>
          </div>
        </div>
      )}
    </section>
  );
}
