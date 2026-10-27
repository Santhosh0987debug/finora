import type { BillRecord } from "../types/api";
import { formatMoney, toFiniteAmount } from "../lib/format";
import {
  AlertIcon,
  BellIcon,
  CheckCircleIcon,
} from "./icons";

interface BillSummaryCardsProps {
  bills: BillRecord[];
}

export function BillSummaryCards({ bills }: BillSummaryCardsProps) {
  const unpaid = bills.filter((bill) => bill.status !== "PAID");
  const overdue = bills.filter((bill) => bill.status === "OVERDUE");
  const paid = bills.filter((bill) => bill.status === "PAID");
  const totalDue = unpaid.reduce(
    (sum, bill) => sum + toFiniteAmount(bill.amount),
    0,
  );
  const overdueAmount = overdue.reduce(
    (sum, bill) => sum + toFiniteAmount(bill.amount),
    0,
  );

  return (
    <div className="grid gap-4 sm:grid-cols-3">
      <article className="rounded-3xl border border-stone-200 bg-white p-5 shadow-sm">
        <div className="flex items-start justify-between gap-4">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-stone-500">
            Outstanding
          </p>
          <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-amber-50 text-amber-700">
            <BellIcon className="h-5 w-5" />
          </span>
        </div>
        <p className="mt-5 text-3xl font-bold tracking-tight tabular-nums text-stone-950">
          {formatMoney(totalDue)}
        </p>
        <p className="mt-2 text-sm text-stone-500">
          {unpaid.length} of {bills.length} bill
          {bills.length === 1 ? "" : "s"} still open
        </p>
      </article>

      <article className="rounded-3xl border border-stone-200 bg-white p-5 shadow-sm">
        <div className="flex items-start justify-between gap-4">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-stone-500">
            Overdue
          </p>
          <span
            className={`flex h-10 w-10 items-center justify-center rounded-2xl ${
              overdue.length > 0
                ? "bg-rose-100 text-rose-700"
                : "bg-stone-100 text-stone-500"
            }`}
          >
            <AlertIcon className="h-5 w-5" />
          </span>
        </div>
        <p className="mt-5 text-3xl font-bold tracking-tight tabular-nums text-stone-950">
          {formatMoney(overdueAmount)}
        </p>
        <p
          className={`mt-2 text-sm ${
            overdue.length > 0 ? "text-rose-700" : "text-stone-500"
          }`}
        >
          {overdue.length > 0
            ? `${overdue.length} bill${overdue.length === 1 ? "" : "s"} past due`
            : "Nothing past due"}
        </p>
      </article>

      <article className="rounded-3xl border border-stone-200 bg-white p-5 shadow-sm">
        <div className="flex items-start justify-between gap-4">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-stone-500">
            Paid
          </p>
          <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700">
            <CheckCircleIcon className="h-5 w-5" />
          </span>
        </div>
        <p className="mt-5 text-3xl font-bold tracking-tight tabular-nums text-stone-950">
          {paid.length}
        </p>
        <p className="mt-2 text-sm text-stone-500">
          Marked paid on this schedule
        </p>
      </article>
    </div>
  );
}
