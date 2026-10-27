import {
  formatAccountType,
  formatSignedMoney,
  formatTransactionDate,
  formatTransactionType,
} from "../lib/format";
import type { RecentTransaction } from "../types/api";
import {
  ArrowDownLeftIcon,
  ArrowRightIcon,
  ArrowUpRightIcon,
  ReceiptIcon,
  RefreshIcon,
} from "./icons";

interface RecentTransactionsProps {
  data: RecentTransaction[];
  onViewAll?: () => void;
}

function TransactionIcon({ type }: { type: RecentTransaction["type"] }) {
  if (type === "INCOME") {
    return <ArrowDownLeftIcon className="h-5 w-5" />;
  }
  if (type === "EXPENSE") {
    return <ArrowUpRightIcon className="h-5 w-5" />;
  }
  return <RefreshIcon className="h-5 w-5" />;
}

export function RecentTransactions({
  data,
  onViewAll,
}: RecentTransactionsProps) {
  return (
    <section className="rounded-3xl border border-stone-200 bg-white p-5 shadow-sm sm:p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold tracking-tight text-stone-950">
            Recent transactions
          </h2>
          <p className="mt-1 text-sm text-stone-500">Your latest five entries</p>
        </div>
        <div className="flex items-center gap-2">
          {onViewAll && (
            <button
              type="button"
              onClick={onViewAll}
              className="inline-flex items-center gap-1.5 rounded-xl px-2.5 py-2 text-xs font-semibold text-emerald-700 transition hover:bg-emerald-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700"
            >
              View all
              <ArrowRightIcon className="h-4 w-4" />
            </button>
          )}
          <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-stone-100 text-stone-500">
            <ReceiptIcon className="h-5 w-5" />
          </span>
        </div>
      </div>

      {data.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-stone-100 text-stone-400">
            <ReceiptIcon className="h-6 w-6" />
          </span>
          <p className="mt-4 font-medium text-stone-700">No transactions yet</p>
          <p className="mt-1 max-w-sm text-sm text-stone-500">
            New income and expenses will appear here as soon as you add them.
          </p>
        </div>
      ) : (
        <ul className="mt-4 divide-y divide-stone-100">
          {data.map((transaction) => {
            const categoryName =
              transaction.category?.name.trim() || "Uncategorized";
            const title =
              transaction.description?.trim() ||
              categoryName ||
              "Transaction";
            const iconTone =
              transaction.type === "INCOME"
                ? "bg-emerald-50 text-emerald-700"
                : transaction.type === "EXPENSE"
                  ? "bg-rose-50 text-rose-700"
                  : "bg-stone-100 text-stone-600";
            const amountTone =
              transaction.type === "INCOME"
                ? "text-emerald-700"
                : transaction.type === "EXPENSE"
                  ? "text-rose-700"
                  : "text-stone-700";
            const badgeTone =
              transaction.type === "INCOME"
                ? "bg-emerald-50 text-emerald-700"
                : transaction.type === "EXPENSE"
                  ? "bg-rose-50 text-rose-700"
                  : "bg-stone-100 text-stone-600";

            return (
              <li
                key={transaction.id}
                className="flex items-center gap-3 py-4 first:pt-2 last:pb-0"
              >
                <span
                  className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl ${iconTone}`}
                >
                  <TransactionIcon type={transaction.type} />
                </span>

                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-stone-900">
                    {title}
                  </p>
                  <p className="mt-1 truncate text-xs text-stone-500">
                    {transaction.account.name} ·{" "}
                    {formatAccountType(transaction.account.type)} ·{" "}
                    {categoryName} ·{" "}
                    {formatTransactionDate(transaction.transactionDate)}
                  </p>
                </div>

                <div className="shrink-0 text-right">
                  <p
                    className={`text-sm font-semibold tabular-nums ${amountTone}`}
                  >
                    {formatSignedMoney(transaction.amount, transaction.type)}
                  </p>
                  <span
                    className={`mt-1 inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${badgeTone}`}
                  >
                    {formatTransactionType(transaction.type)}
                  </span>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
