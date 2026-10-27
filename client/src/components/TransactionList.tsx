import {
  formatSignedMoney,
  formatTransactionDate,
  formatTransactionType,
} from "../lib/format";
import type { Account, Category, TransactionRecord } from "../types/api";
import {
  ArrowDownLeftIcon,
  ArrowUpRightIcon,
  PencilIcon,
  RefreshIcon,
  TrashIcon,
} from "./icons";

interface TransactionListProps {
  transactions: TransactionRecord[];
  accountsById: Map<string, Account>;
  categoriesById: Map<string, Category>;
  editingId: string | null;
  confirmingDeleteId: string | null;
  deletingId: string | null;
  editDisabled: boolean;
  onEdit: (transaction: TransactionRecord) => void;
  onRequestDelete: (id: string) => void;
  onCancelDelete: () => void;
  onConfirmDelete: (id: string) => void;
}

function TransactionIcon({ type }: { type: TransactionRecord["type"] }) {
  if (type === "INCOME") {
    return <ArrowDownLeftIcon className="h-5 w-5" />;
  }
  if (type === "EXPENSE") {
    return <ArrowUpRightIcon className="h-5 w-5" />;
  }
  return <RefreshIcon className="h-5 w-5" />;
}

function toneFor(type: TransactionRecord["type"]) {
  if (type === "INCOME") {
    return {
      icon: "bg-emerald-50 text-emerald-700",
      amount: "text-emerald-700",
      badge: "bg-emerald-50 text-emerald-700",
    };
  }
  if (type === "EXPENSE") {
    return {
      icon: "bg-rose-50 text-rose-700",
      amount: "text-rose-700",
      badge: "bg-rose-50 text-rose-700",
    };
  }
  return {
    icon: "bg-stone-100 text-stone-600",
    amount: "text-stone-700",
    badge: "bg-stone-100 text-stone-600",
  };
}

export function TransactionList({
  transactions,
  accountsById,
  categoriesById,
  editingId,
  confirmingDeleteId,
  deletingId,
  editDisabled,
  onEdit,
  onRequestDelete,
  onCancelDelete,
  onConfirmDelete,
}: TransactionListProps) {
  return (
    <ul className="divide-y divide-stone-100">
      {transactions.map((transaction) => {
        const account = accountsById.get(transaction.accountId);
        const category = transaction.categoryId
          ? categoriesById.get(transaction.categoryId)
          : null;
        const categoryName = transaction.categoryId
          ? (category?.name ?? "Unknown category")
          : "Uncategorized";
        const title =
          transaction.description?.trim() || categoryName || "Transaction";
        const tone = toneFor(transaction.type);
        const isEditing = editingId === transaction.id;
        const isConfirmingDelete = confirmingDeleteId === transaction.id;
        const isDeleting = deletingId === transaction.id;
        const isTransfer = transaction.type === "TRANSFER";

        return (
          <li
            key={transaction.id}
            className={`px-5 py-4 transition-colors first:rounded-t-3xl last:rounded-b-3xl sm:px-6 ${
              isEditing ? "bg-emerald-50/60" : "hover:bg-stone-50/70"
            }`}
          >
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
              <div className="flex min-w-0 flex-1 items-start gap-3">
                <span
                  className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl ${tone.icon}`}
                >
                  <TransactionIcon type={transaction.type} />
                </span>

                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="truncate text-sm font-semibold text-stone-900">
                      {title}
                    </p>
                    <span
                      className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${tone.badge}`}
                    >
                      {formatTransactionType(transaction.type)}
                    </span>
                    {isEditing && (
                      <span className="inline-flex rounded-full bg-emerald-700 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white">
                        Editing
                      </span>
                    )}
                  </div>

                  <dl className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-stone-500">
                    <div className="flex gap-1">
                      <dt className="text-stone-400">Account</dt>
                      <dd className="font-medium text-stone-600">
                        {account?.name ?? "Unknown account"}
                      </dd>
                    </div>
                    <div className="flex gap-1">
                      <dt className="text-stone-400">Category</dt>
                      <dd className="font-medium text-stone-600">
                        {categoryName}
                      </dd>
                    </div>
                    <div className="flex gap-1">
                      <dt className="text-stone-400">Date</dt>
                      <dd className="font-medium text-stone-600">
                        {formatTransactionDate(transaction.transactionDate)}
                      </dd>
                    </div>
                  </dl>
                </div>
              </div>

              <div className="flex items-center justify-between gap-3 pl-[3.25rem] sm:flex-col sm:items-end sm:pl-0">
                <p
                  className={`text-sm font-semibold tabular-nums ${tone.amount}`}
                >
                  {formatSignedMoney(transaction.amount, transaction.type)}
                </p>

                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => onEdit(transaction)}
                    disabled={editDisabled || isDeleting || isTransfer}
                    title={
                      isTransfer
                        ? "Transfer transactions are not supported"
                        : editDisabled
                          ? "Account and category options are not available"
                          : "Edit transaction"
                    }
                    className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-stone-200 bg-white text-stone-500 transition hover:border-emerald-200 hover:bg-emerald-50 hover:text-emerald-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    <PencilIcon className="h-4 w-4" />
                    <span className="sr-only">Edit transaction</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => onRequestDelete(transaction.id)}
                    disabled={isDeleting}
                    title="Delete transaction"
                    className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-stone-200 bg-white text-stone-500 transition hover:border-rose-200 hover:bg-rose-50 hover:text-rose-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rose-700 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    <TrashIcon className="h-4 w-4" />
                    <span className="sr-only">Delete transaction</span>
                  </button>
                </div>
              </div>
            </div>

            {isConfirmingDelete && (
              <div
                role="alert"
                className="mt-4 flex flex-col gap-3 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800 sm:flex-row sm:items-center sm:justify-between"
              >
                <p>
                  Delete this transaction? The account balance will be adjusted.
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
                    onClick={() => onConfirmDelete(transaction.id)}
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
          </li>
        );
      })}
    </ul>
  );
}
