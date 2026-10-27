import type { Account, Category } from "../types/api";
import {
  formatAccountType,
} from "../lib/format";
import {
  hasTransactionFilters,
  type TransactionFilterValues,
} from "../lib/transactions";
import { FilterIcon } from "./icons";

interface TransactionFiltersProps {
  accounts: Account[];
  categories: Category[];
  filters: TransactionFilterValues;
  onChange: (filters: TransactionFilterValues) => void;
  onClear: () => void;
}

const filterInputClass =
  "mt-1.5 w-full rounded-xl border border-stone-200 bg-white px-3 py-2.5 text-sm text-stone-900 shadow-sm outline-none transition focus:border-emerald-600 focus:ring-4 focus:ring-emerald-700/10";

export function TransactionFilters({
  accounts,
  categories,
  filters,
  onChange,
  onClear,
}: TransactionFiltersProps) {
  const visibleCategories = categories.filter(
    (category) => !filters.type || category.type === filters.type,
  );
  const hasFilters = hasTransactionFilters(filters);

  const change = (
    key: keyof TransactionFilterValues,
    value: string,
  ) => {
    const next = { ...filters, [key]: value } as TransactionFilterValues;

    if (key === "type") {
      const selectedCategory = categories.find(
        (category) => category.id === next.categoryId,
      );
      if (
        selectedCategory &&
        next.type &&
        selectedCategory.type !== next.type
      ) {
        next.categoryId = "";
      }
    }
    if (key === "from" && next.to && next.from > next.to) {
      next.to = "";
    }
    if (key === "to" && next.from && next.to < next.from) {
      next.from = "";
    }

    onChange(next);
  };

  return (
    <section
      className="rounded-3xl border border-stone-200 bg-white p-5 shadow-sm sm:p-6"
      aria-label="Transaction filters"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-stone-100 text-stone-500">
            <FilterIcon className="h-4 w-4" />
          </span>
          <div>
            <h2 className="text-sm font-semibold text-stone-900">Filters</h2>
            <p className="text-xs text-stone-500">
              Narrow the list by type, account, category, or date.
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={onClear}
          disabled={!hasFilters}
          className="rounded-xl px-3 py-2 text-xs font-semibold text-emerald-700 transition hover:bg-emerald-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700 disabled:cursor-not-allowed disabled:text-stone-300 disabled:hover:bg-transparent"
        >
          Clear filters
        </button>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        <div>
          <label
            htmlFor="transaction-filter-type"
            className="text-xs font-medium text-stone-500"
          >
            Type
          </label>
          <select
            id="transaction-filter-type"
            value={filters.type}
            onChange={(event) => change("type", event.target.value)}
            className={filterInputClass}
          >
            <option value="">All types</option>
            <option value="INCOME">Income</option>
            <option value="EXPENSE">Expense</option>
          </select>
        </div>

        <div>
          <label
            htmlFor="transaction-filter-account"
            className="text-xs font-medium text-stone-500"
          >
            Account
          </label>
          <select
            id="transaction-filter-account"
            value={filters.accountId}
            onChange={(event) => change("accountId", event.target.value)}
            className={filterInputClass}
          >
            <option value="">All accounts</option>
            {accounts.map((account) => (
              <option key={account.id} value={account.id}>
                {account.name} · {formatAccountType(account.type)}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label
            htmlFor="transaction-filter-category"
            className="text-xs font-medium text-stone-500"
          >
            Category
          </label>
          <select
            id="transaction-filter-category"
            value={filters.categoryId}
            onChange={(event) => change("categoryId", event.target.value)}
            className={filterInputClass}
          >
            <option value="">All categories</option>
            {visibleCategories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label
            htmlFor="transaction-filter-from"
            className="text-xs font-medium text-stone-500"
          >
            From
          </label>
          <input
            id="transaction-filter-from"
            type="date"
            value={filters.from}
            max={filters.to || undefined}
            onChange={(event) => change("from", event.target.value)}
            className={filterInputClass}
          />
        </div>

        <div>
          <label
            htmlFor="transaction-filter-to"
            className="text-xs font-medium text-stone-500"
          >
            To
          </label>
          <input
            id="transaction-filter-to"
            type="date"
            value={filters.to}
            min={filters.from || undefined}
            onChange={(event) => change("to", event.target.value)}
            className={filterInputClass}
          />
        </div>
      </div>
    </section>
  );
}
