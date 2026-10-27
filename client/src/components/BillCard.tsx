import type { BillRecord } from "../types/api";
import {
  BILL_FREQUENCY_LABELS,
  BILL_STATUS_LABELS,
  billDueLabel,
  formatBillDueDate,
} from "../lib/bills";
import { formatMoney } from "../lib/format";
import {
  AlertIcon,
  BellIcon,
  CalendarIcon,
  CheckCircleIcon,
  PencilIcon,
  RefreshIcon,
  TrashIcon,
} from "./icons";

interface BillCardProps {
  bill: BillRecord;
  isEditing: boolean;
  confirmingDelete: boolean;
  deleting: boolean;
  statusUpdating: boolean;
  actionsDisabled: boolean;
  onEdit: (bill: BillRecord) => void;
  onTogglePaid: (bill: BillRecord) => void;
  onRequestDelete: (id: string) => void;
  onCancelDelete: () => void;
  onConfirmDelete: (id: string) => void;
}

export function BillCard({
  bill,
  isEditing,
  confirmingDelete,
  deleting,
  statusUpdating,
  actionsDisabled,
  onEdit,
  onTogglePaid,
  onRequestDelete,
  onCancelDelete,
  onConfirmDelete,
}: BillCardProps) {
  const isPaid = bill.status === "PAID";
  const isOverdue = bill.status === "OVERDUE";
  const statusClasses = isPaid
    ? "bg-emerald-100 text-emerald-800"
    : isOverdue
      ? "bg-rose-100 text-rose-800"
      : "bg-amber-100 text-amber-800";
  const iconClasses = isPaid
    ? "bg-emerald-700 text-white"
    : isOverdue
      ? "bg-rose-100 text-rose-700"
      : "bg-amber-50 text-amber-700";
  const dueClasses = isPaid
    ? "text-stone-500"
    : isOverdue
      ? "text-rose-700"
      : "text-stone-600";
  const actionsAreDisabled = actionsDisabled || statusUpdating || deleting;

  return (
    <article
      className={`px-5 py-5 transition sm:px-6 ${
        isEditing
          ? "bg-emerald-50/40"
          : isOverdue
            ? "bg-rose-50/30"
            : "bg-white"
      }`}
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 items-start gap-3">
          <span
            className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl ${iconClasses}`}
          >
            {isPaid ? (
              <CheckCircleIcon className="h-5 w-5" />
            ) : isOverdue ? (
              <AlertIcon className="h-5 w-5" />
            ) : (
              <BellIcon className="h-5 w-5" />
            )}
          </span>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h3
                className={`truncate font-semibold ${
                  isPaid ? "text-stone-600" : "text-stone-950"
                }`}
              >
                {bill.name}
              </h3>
              <span
                className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${statusClasses}`}
              >
                {BILL_STATUS_LABELS[bill.status]}
              </span>
            </div>
            <p className="mt-1 text-xs text-stone-500">
              {BILL_FREQUENCY_LABELS[bill.frequency]}
            </p>
          </div>
        </div>

        <div className="shrink-0 sm:text-right">
          <p
            className={`text-xl font-bold tracking-tight tabular-nums ${
              isPaid ? "text-stone-500" : "text-stone-950"
            }`}
          >
            {formatMoney(bill.amount)}
          </p>
          <p className={`mt-1 text-xs font-semibold ${dueClasses}`}>
            {billDueLabel(bill)}
          </p>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-stone-100 pt-4">
        <span className="inline-flex items-center gap-1.5 text-xs text-stone-500">
          <CalendarIcon className="h-3.5 w-3.5 text-stone-400" />
          Due {formatBillDueDate(bill.dueDate)}
        </span>

        <div className="flex flex-wrap items-center gap-2 sm:ml-auto">
          <button
            type="button"
            onClick={() => onTogglePaid(bill)}
            disabled={actionsAreDisabled}
            className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-semibold transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700 disabled:cursor-not-allowed disabled:opacity-50 ${
              isPaid
                ? "border border-stone-200 bg-white text-stone-600 hover:border-stone-300 hover:text-stone-900"
                : "bg-emerald-700 text-white hover:bg-emerald-800"
            }`}
          >
            {statusUpdating ? (
              <span
                className={`h-3.5 w-3.5 animate-spin rounded-full border-2 ${
                  isPaid
                    ? "border-stone-300 border-t-stone-600"
                    : "border-white/30 border-t-white"
                }`}
                aria-hidden="true"
              />
            ) : isPaid ? (
              <RefreshIcon className="h-3.5 w-3.5" />
            ) : (
              <CheckCircleIcon className="h-3.5 w-3.5" />
            )}
            {statusUpdating
              ? "Updating."
              : isPaid
                ? "Mark unpaid"
                : "Mark paid"}
          </button>

          <button
            type="button"
            onClick={() => onEdit(bill)}
            disabled={actionsAreDisabled}
            className="inline-flex items-center gap-1.5 rounded-xl border border-stone-200 bg-white px-3 py-2 text-xs font-semibold text-stone-600 transition hover:border-stone-300 hover:text-stone-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <PencilIcon className="h-3.5 w-3.5" />
            Edit
          </button>

          <button
            type="button"
            onClick={() => onRequestDelete(bill.id)}
            disabled={actionsAreDisabled}
            aria-label={`Delete ${bill.name}`}
            className="inline-flex items-center justify-center rounded-xl border border-stone-200 bg-white px-2.5 py-2 text-stone-500 transition hover:border-rose-200 hover:bg-rose-50 hover:text-rose-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rose-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <TrashIcon className="h-4 w-4" />
          </button>
        </div>
      </div>

      {confirmingDelete && (
        <div
          role="group"
          aria-label={`Delete ${bill.name}`}
          className="mt-3 rounded-2xl border border-rose-200 bg-rose-50 p-4"
        >
          <p className="text-sm font-semibold text-rose-900">
            Delete "{bill.name}"?
          </p>
          <p className="mt-1 text-xs text-rose-700">
            This removes the bill from your schedule. This cannot be undone.
          </p>
          <div className="mt-3 flex gap-2">
            <button
              type="button"
              onClick={() => onConfirmDelete(bill.id)}
              disabled={deleting}
              className="inline-flex items-center gap-1.5 rounded-xl bg-rose-700 px-3 py-2 text-xs font-semibold text-white transition hover:bg-rose-800 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {deleting && (
                <span
                  className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/30 border-t-white"
                  aria-hidden="true"
                />
              )}
              {deleting ? "Deleting." : "Delete bill"}
            </button>
            <button
              type="button"
              onClick={onCancelDelete}
              disabled={deleting}
              className="rounded-xl border border-rose-200 bg-white px-3 py-2 text-xs font-semibold text-rose-700 transition hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-60"
            >
              Keep bill
            </button>
          </div>
        </div>
      )}
    </article>
  );
}
