import { formatMoney, formatPercent } from "../lib/format";
import {
  BUDGET_STATUS_LABELS,
  budgetProgressWidth,
} from "../lib/budgets";
import type { BudgetRecord, BudgetStatus } from "../types/api";
import {
  AlertIcon,
  CheckCircleIcon,
  PencilIcon,
  TargetIcon,
  TrashIcon,
  TrendUpIcon,
} from "./icons";

interface BudgetListProps {
  budgets: BudgetRecord[];
  editingId: string | null;
  confirmingDeleteId: string | null;
  deletingId: string | null;
  editDisabled: boolean;
  onEdit: (budget: BudgetRecord) => void;
  onRequestDelete: (id: string) => void;
  onCancelDelete: () => void;
  onConfirmDelete: (id: string) => void;
}

const statusMeta: Record<
  BudgetStatus,
  { badge: string; bar: string; icon: string }
> = {
  UNDER: {
    badge: "bg-emerald-50 text-emerald-700",
    bar: "bg-emerald-600",
    icon: "bg-emerald-50 text-emerald-700",
  },
  APPROACHING: {
    badge: "bg-amber-50 text-amber-700",
    bar: "bg-amber-500",
    icon: "bg-amber-50 text-amber-700",
  },
  OVER: {
    badge: "bg-rose-50 text-rose-700",
    bar: "bg-rose-600",
    icon: "bg-rose-50 text-rose-700",
  },
};

function StatusIcon({ status }: { status: BudgetStatus }) {
  if (status === "UNDER") {
    return <CheckCircleIcon className="h-4 w-4" />;
  }
  if (status === "APPROACHING") {
    return <TrendUpIcon className="h-4 w-4" />;
  }
  return <AlertIcon className="h-4 w-4" />;
}

export function BudgetList({
  budgets,
  editingId,
  confirmingDeleteId,
  deletingId,
  editDisabled,
  onEdit,
  onRequestDelete,
  onCancelDelete,
  onConfirmDelete,
}: BudgetListProps) {
  return (
    <ul className="divide-y divide-stone-100">
      {budgets.map((budget) => {
        const categoryName = budget.category.name.trim() || "Uncategorized";
        const isEditing = editingId === budget.id;
        const isConfirmingDelete = confirmingDeleteId === budget.id;
        const isDeleting = deletingId === budget.id;
        const meta = statusMeta[budget.status];
        const width = budgetProgressWidth(budget.percentage);

        return (
          <li
            key={budget.id}
            className={`px-5 py-5 transition-colors first:rounded-t-3xl last:rounded-b-3xl sm:px-6 ${
              isEditing ? "bg-emerald-50/60" : "hover:bg-stone-50/70"
            }`}
          >
            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="flex min-w-0 items-start gap-3">
                  <span
                    className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl ${meta.icon}`}
                  >
                    <TargetIcon className="h-5 w-5" />
                  </span>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="truncate text-sm font-semibold text-stone-900">
                        {categoryName}
                      </p>
                      <span
                        className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${meta.badge}`}
                      >
                        <StatusIcon status={budget.status} />
                        {BUDGET_STATUS_LABELS[budget.status]}
                      </span>
                      {isEditing && (
                        <span className="inline-flex rounded-full bg-emerald-700 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white">
                          Editing
                        </span>
                      )}
                    </div>
                    <p className="mt-1 text-xs text-stone-500">
                      {formatPercent(budget.percentage)} of the monthly limit
                      used
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-1 sm:shrink-0">
                  <button
                    type="button"
                    onClick={() => onEdit(budget)}
                    disabled={editDisabled || isDeleting}
                    title={
                      editDisabled
                        ? "Expense categories are not available"
                        : "Edit budget"
                    }
                    className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-stone-200 bg-white text-stone-500 transition hover:border-emerald-200 hover:bg-emerald-50 hover:text-emerald-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    <PencilIcon className="h-4 w-4" />
                    <span className="sr-only">Edit budget</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => onRequestDelete(budget.id)}
                    disabled={isDeleting}
                    title="Delete budget"
                    className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-stone-200 bg-white text-stone-500 transition hover:border-rose-200 hover:bg-rose-50 hover:text-rose-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rose-700 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    <TrashIcon className="h-4 w-4" />
                    <span className="sr-only">Delete budget</span>
                  </button>
                </div>
              </div>

              <dl className="grid gap-2 rounded-2xl bg-stone-50/80 px-4 py-3 text-xs sm:grid-cols-3">
                <div>
                  <dt className="text-stone-400">Monthly limit</dt>
                  <dd className="mt-1 font-semibold tabular-nums text-stone-800">
                    {formatMoney(budget.amount)}
                  </dd>
                </div>
                <div>
                  <dt className="text-stone-400">Current spending</dt>
                  <dd className="mt-1 font-semibold tabular-nums text-stone-800">
                    {formatMoney(budget.spent)}
                  </dd>
                </div>
                <div>
                  <dt className="text-stone-400">Remaining</dt>
                  <dd
                    className={`mt-1 font-semibold tabular-nums ${
                      budget.status === "OVER"
                        ? "text-rose-700"
                        : "text-stone-800"
                    }`}
                  >
                    {formatMoney(budget.remaining)}
                  </dd>
                </div>
              </dl>

              <div>
                <div className="flex items-center justify-between gap-3 text-[11px] font-medium text-stone-500">
                  <span>Progress</span>
                  <span className="tabular-nums">
                    {formatPercent(budget.percentage)}
                  </span>
                </div>
                <div
                  className="mt-1.5 h-2 overflow-hidden rounded-full bg-stone-100"
                  role="progressbar"
                  aria-label={`${categoryName} budget usage`}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={Math.round(width)}
                >
                  <div
                    className={`h-full rounded-full transition-[width] ${meta.bar}`}
                    style={{ width: `${width}%` }}
                  />
                </div>
              </div>

              {isConfirmingDelete && (
                <div
                  role="alert"
                  className="flex flex-col gap-3 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800 sm:flex-row sm:items-center sm:justify-between"
                >
                  <p>
                    Delete the {categoryName} budget? Transactions and account
                    balances are not changed.
                  </p>
                  <div className="flex shrink-0 gap-2">
                    <button
                      type="button"
                      onClick={onCancelDelete}
                      disabled={isDeleting}
                      className="rounded-xl border border-rose-200 bg-white px-3 py-2 text-xs font-semibold text-rose-700 transition hover:border-rose-300 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={() => onConfirmDelete(budget.id)}
                      disabled={isDeleting}
                      className="inline-flex items-center gap-2 rounded-xl bg-rose-700 px-3 py-2 text-xs font-semibold text-white transition hover:bg-rose-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rose-700 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {isDeleting && (
                        <span
                          className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/30 border-t-white"
                          aria-hidden="true"
                        />
                      )}
                      {isDeleting ? "Deleting…" : "Delete"}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </li>
        );
      })}
    </ul>
  );
}
