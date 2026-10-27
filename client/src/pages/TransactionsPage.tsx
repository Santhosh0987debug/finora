import { useEffect, useMemo, useRef, useState } from "react";
import { ApiError } from "../api/client";
import {
  createTransaction,
  deleteTransaction,
  updateTransaction,
  type TransactionQuery,
} from "../api/transactions";
import { AppHeader } from "../components/AppHeader";
import { TransactionFilters } from "../components/TransactionFilters";
import { TransactionForm } from "../components/TransactionForm";
import { TransactionList } from "../components/TransactionList";
import { TransactionPagination } from "../components/TransactionPagination";
import {
  AlertIcon,
  CheckCircleIcon,
  CloseIcon,
  ReceiptIcon,
  RefreshIcon,
} from "../components/icons";
import { useTransactionList } from "../hooks/useTransactionList";
import { useTransactionOptions } from "../hooks/useTransactionOptions";
import { formatMoney } from "../lib/format";
import {
  EMPTY_TRANSACTION_FILTERS,
  emptyTransactionForm,
  formValuesFromTransaction,
  hasTransactionFilters,
  toTransactionMutationInput,
  transactionMatchesFilters,
  type TransactionFilterValues,
  type TransactionFormValues,
} from "../lib/transactions";
import type { AuthUser, TransactionRecord } from "../types/api";
import type { AppView } from "../types/navigation";

interface TransactionsPageProps {
  user: AuthUser;
  token: string;
  onLogout: () => void;
  onNavigate: (view: AppView) => void;
  onDataChanged: () => void;
}

const PAGE_SIZE = 10;

function TransactionListSkeleton() {
  return (
    <div
      className="animate-pulse px-5 py-4 sm:px-6"
      role="status"
      aria-live="polite"
      aria-label="Loading transactions"
    >
      <span className="sr-only">Loading transactions…</span>
      <div className="space-y-4">
        {[0, 1, 2, 3, 4].map((item) => (
          <div key={item} className="flex items-center gap-3 py-3">
            <div className="h-10 w-10 shrink-0 rounded-2xl bg-stone-100" />
            <div className="min-w-0 flex-1 space-y-2">
              <div className="h-3.5 w-40 max-w-full rounded-full bg-stone-200" />
              <div className="h-3 w-56 max-w-full rounded-full bg-stone-100" />
            </div>
            <div className="h-4 w-20 rounded-full bg-stone-100" />
          </div>
        ))}
      </div>
    </div>
  );
}

export function TransactionsPage({
  user,
  token,
  onLogout,
  onNavigate,
  onDataChanged,
}: TransactionsPageProps) {
  const options = useTransactionOptions(token, onLogout);
  const [filters, setFilters] = useState<TransactionFilterValues>(
    EMPTY_TRANSACTION_FILTERS,
  );
  const [page, setPage] = useState(1);
  const [formVersion, setFormVersion] = useState(0);
  const [editingTransaction, setEditingTransaction] =
    useState<TransactionRecord | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [confirmingDeleteId, setConfirmingDeleteId] = useState<string | null>(
    null,
  );
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const formSectionRef = useRef<HTMLDivElement>(null);

  const query = useMemo<TransactionQuery>(
    () => ({
      page,
      limit: PAGE_SIZE,
      ...(filters.accountId ? { accountId: filters.accountId } : {}),
      ...(filters.categoryId ? { categoryId: filters.categoryId } : {}),
      ...(filters.type ? { type: filters.type } : {}),
      ...(filters.from ? { from: `${filters.from}T00:00:00.000Z` } : {}),
      ...(filters.to ? { to: `${filters.to}T23:59:59.999Z` } : {}),
    }),
    [page, filters],
  );

  const list = useTransactionList(token, query, onLogout);

  const accountsById = useMemo(
    () => new Map(options.accounts.map((account) => [account.id, account])),
    [options.accounts],
  );
  const categoriesById = useMemo(
    () => new Map(options.categories.map((category) => [category.id, category])),
    [options.categories],
  );

  useEffect(() => {
    if (!editingTransaction) {
      return;
    }
    formSectionRef.current?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  }, [editingTransaction]);

  const initialValues = editingTransaction
    ? formValuesFromTransaction(editingTransaction)
    : emptyTransactionForm(options.accounts[0]?.id ?? "");

  const clearEditing = () => {
    setEditingTransaction(null);
    setFormError(null);
    setFormVersion((version) => version + 1);
  };

  const handleEdit = (transaction: TransactionRecord) => {
    setActionError(null);
    setSuccessMessage(null);
    setConfirmingDeleteId(null);
    setFormError(null);
    setEditingTransaction(transaction);
    setFormVersion((version) => version + 1);
  };

  const handleSubmit = async (values: TransactionFormValues) => {
    if (submitting) {
      return;
    }
    setSubmitting(true);
    setFormError(null);
    setActionError(null);
    setSuccessMessage(null);

    try {
      const input = toTransactionMutationInput(values);
      if (editingTransaction) {
        await updateTransaction(token, editingTransaction.id, input);
        if (
          page > 1 &&
          transactions.length === 1 &&
          !transactionMatchesFilters(input, filters)
        ) {
          setPage(page - 1);
        }
        setSuccessMessage(
          `${input.type === "INCOME" ? "Income" : "Expense"} of ${formatMoney(input.amount)} updated.`,
        );
      } else {
        await createTransaction(token, input);
        setSuccessMessage(
          `${input.type === "INCOME" ? "Income" : "Expense"} of ${formatMoney(input.amount)} added.`,
        );
      }
      setEditingTransaction(null);
      setConfirmingDeleteId(null);
      setFormVersion((version) => version + 1);
      list.refresh();
      onDataChanged();
    } catch (caught) {
      if (caught instanceof ApiError && caught.status === 401) {
        onLogout();
        return;
      }
      setFormError(
        caught instanceof Error
          ? caught.message
          : "Could not save this transaction.",
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleConfirmDelete = async (id: string) => {
    if (deletingId) {
      return;
    }
    setDeletingId(id);
    setActionError(null);
    setSuccessMessage(null);

    try {
      await deleteTransaction(token, id);
      if (page > 1 && transactions.length === 1) {
        setPage(page - 1);
      }
      if (editingTransaction?.id === id) {
        setEditingTransaction(null);
        setFormVersion((version) => version + 1);
        setFormError(null);
      }
      setConfirmingDeleteId(null);
      setSuccessMessage("Transaction deleted.");
      list.refresh();
      onDataChanged();
    } catch (caught) {
      if (caught instanceof ApiError && caught.status === 401) {
        onLogout();
        return;
      }
      setActionError(
        caught instanceof Error
          ? caught.message
          : "Could not delete this transaction.",
      );
    } finally {
      setDeletingId(null);
    }
  };

  const handleFilterChange = (next: TransactionFilterValues) => {
    setFilters(next);
    setPage(1);
    setConfirmingDeleteId(null);
    setActionError(null);
  };

  const handleClearFilters = () => {
    setFilters({ ...EMPTY_TRANSACTION_FILTERS });
    setPage(1);
    setConfirmingDeleteId(null);
    setActionError(null);
  };

  const filtered = hasTransactionFilters(filters);
  const transactions = list.data?.transactions ?? [];
  const pagination = list.data?.pagination;
  const total = pagination?.total ?? 0;

  return (
    <div className="min-h-screen bg-stone-50 text-stone-900">
      <AppHeader
        user={user}
        onLogout={onLogout}
        activeView="transactions"
        onNavigate={onNavigate}
      />

      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 sm:py-10 lg:px-8">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-700">
              Transactions
            </p>
            <h1 className="mt-2 text-3xl font-bold tracking-tight text-stone-950 sm:text-4xl">
              Every money movement, in one place.
            </h1>
            <p className="mt-2 text-sm text-stone-500 sm:text-base">
              Record income and expenses, then review and filter your history.
            </p>
          </div>
          <div className="flex items-center gap-2 rounded-full border border-stone-200 bg-white px-4 py-2 text-sm text-stone-600 shadow-sm">
            <ReceiptIcon className="h-4 w-4 text-stone-400" />
            <span className="tabular-nums">
              {total} transaction{total === 1 ? "" : "s"}
            </span>
          </div>
        </div>

        <div className="mt-6 space-y-3">
          {successMessage && (
            <div
              role="status"
              className="flex items-center gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800"
            >
              <CheckCircleIcon className="h-4 w-4 shrink-0" />
              <span className="flex-1">{successMessage}</span>
              <button
                type="button"
                onClick={() => setSuccessMessage(null)}
                aria-label="Dismiss success message"
                className="rounded-lg p-1 text-emerald-700 transition hover:bg-emerald-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700"
              >
                <CloseIcon className="h-4 w-4" />
              </button>
            </div>
          )}

          {actionError && (
            <div
              role="alert"
              className="flex items-start gap-3 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800"
            >
              <AlertIcon className="mt-0.5 h-4 w-4 shrink-0" />
              <span className="flex-1">{actionError}</span>
              <button
                type="button"
                onClick={() => setActionError(null)}
                aria-label="Dismiss error message"
                className="rounded-lg p-1 text-rose-700 transition hover:bg-rose-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rose-700"
              >
                <CloseIcon className="h-4 w-4" />
              </button>
            </div>
          )}
        </div>

        <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1fr)_390px]">
          <div className="order-2 space-y-6 xl:order-1">
            {options.status === "ready" && (
              <TransactionFilters
                accounts={options.accounts}
                categories={options.categories}
                filters={filters}
                onChange={handleFilterChange}
                onClear={handleClearFilters}
              />
            )}

            {options.status === "error" && (
              <section
                role="alert"
                className="flex flex-col gap-4 rounded-3xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-900 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="flex items-start gap-3">
                  <AlertIcon className="mt-0.5 h-4 w-4 shrink-0" />
                  <div>
                    <p className="font-semibold">
                      Account and category options could not load.
                    </p>
                    <p className="mt-1 text-amber-800">
                      {options.error ??
                        "The transaction list is still available, but creating and editing are paused."}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={options.retry}
                  className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl border border-amber-300 bg-white px-3 py-2 text-xs font-semibold text-amber-800 transition hover:border-amber-400 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-700"
                >
                  <RefreshIcon className="h-4 w-4" />
                  Try again
                </button>
              </section>
            )}

            <section className="overflow-hidden rounded-3xl border border-stone-200 bg-white shadow-sm">
              <div className="flex items-start justify-between gap-4 px-5 pb-4 pt-5 sm:px-6 sm:pt-6">
                <div>
                  <h2 className="text-lg font-semibold tracking-tight text-stone-950">
                    Transaction history
                  </h2>
                  <p className="mt-1 text-sm text-stone-500">
                    {filtered
                      ? "Transactions matching your current filters"
                      : "All transactions across your accounts"}
                  </p>
                </div>
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-stone-100 text-stone-500">
                  <ReceiptIcon className="h-5 w-5" />
                </span>
              </div>

              {list.status === "loading" && <TransactionListSkeleton />}

              {list.status === "error" && (
                <div
                  role="alert"
                  className="mx-5 mb-6 rounded-2xl border border-rose-200 bg-rose-50 p-6 text-center sm:mx-6"
                >
                  <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-white text-rose-700">
                    <AlertIcon className="h-6 w-6" />
                  </span>
                  <h3 className="mt-4 font-semibold text-stone-950">
                    We could not load your transactions
                  </h3>
                  <p className="mx-auto mt-2 max-w-md text-sm text-stone-500">
                    {list.error ?? "Please try again in a moment."}
                  </p>
                  <button
                    type="button"
                    onClick={list.refresh}
                    className="mt-5 inline-flex items-center gap-2 rounded-2xl bg-emerald-700 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700"
                  >
                    <RefreshIcon className="h-4 w-4" />
                    Try again
                  </button>
                </div>
              )}

              {list.status === "ready" && transactions.length === 0 && (
                <div className="flex flex-col items-center justify-center px-5 py-14 text-center">
                  <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-stone-100 text-stone-400">
                    <ReceiptIcon className="h-6 w-6" />
                  </span>
                  <p className="mt-4 font-medium text-stone-700">
                    {filtered
                      ? "No transactions match these filters"
                      : "No transactions yet"}
                  </p>
                  <p className="mt-1 max-w-sm text-sm text-stone-500">
                    {filtered
                      ? "Try a different account, category, type, or date range."
                      : "Use the form to add your first income or expense."}
                  </p>
                  {filtered && (
                    <button
                      type="button"
                      onClick={handleClearFilters}
                      className="mt-4 rounded-xl border border-stone-200 bg-white px-3 py-2 text-xs font-semibold text-stone-600 transition hover:border-stone-300 hover:text-stone-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700"
                    >
                      Clear filters
                    </button>
                  )}
                </div>
              )}

              {list.status === "ready" && transactions.length > 0 && (
                <>
                  <TransactionList
                    transactions={transactions}
                    accountsById={accountsById}
                    categoriesById={categoriesById}
                    editingId={editingTransaction?.id ?? null}
                    confirmingDeleteId={confirmingDeleteId}
                    deletingId={deletingId}
                    editDisabled={options.status !== "ready"}
                    onEdit={handleEdit}
                    onRequestDelete={setConfirmingDeleteId}
                    onCancelDelete={() => setConfirmingDeleteId(null)}
                    onConfirmDelete={handleConfirmDelete}
                  />
                  {pagination && (
                    <TransactionPagination
                      page={pagination.page}
                      total={pagination.total}
                      totalPages={pagination.totalPages}
                      hasNext={pagination.hasNext}
                      hasPrevious={pagination.hasPrevious}
                      onPageChange={(nextPage) => {
                        if (nextPage < 1) {
                          return;
                        }
                        setPage(nextPage);
                        setConfirmingDeleteId(null);
                        setActionError(null);
                      }}
                    />
                  )}
                </>
              )}
            </section>
          </div>

          <div
            ref={formSectionRef}
            className="order-1 scroll-mt-24 xl:order-2"
          >
            <section className="rounded-3xl border border-stone-200 bg-white p-5 shadow-sm sm:p-6 xl:sticky xl:top-24">
              {options.status === "loading" && (
                <div
                  className="animate-pulse"
                  role="status"
                  aria-live="polite"
                  aria-label="Loading transaction form"
                >
                  <span className="sr-only">
                    Loading account and category options…
                  </span>
                  <div className="h-3 w-20 rounded-full bg-stone-200" />
                  <div className="mt-3 h-5 w-40 rounded-full bg-stone-200" />
                  <div className="mt-2 h-3 w-56 rounded-full bg-stone-100" />
                  <div className="mt-6 space-y-4">
                    <div className="h-12 rounded-2xl bg-stone-100" />
                    <div className="h-12 rounded-2xl bg-stone-100" />
                    <div className="h-12 rounded-2xl bg-stone-100" />
                    <div className="h-12 rounded-2xl bg-stone-100" />
                    <div className="h-24 rounded-2xl bg-stone-100" />
                  </div>
                </div>
              )}

              {options.status === "error" && (
                <div role="alert" className="text-center">
                  <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-rose-50 text-rose-700">
                    <AlertIcon className="h-6 w-6" />
                  </span>
                  <h2 className="mt-4 font-semibold text-stone-950">
                    Transaction form unavailable
                  </h2>
                  <p className="mx-auto mt-2 max-w-sm text-sm text-stone-500">
                    {options.error ??
                      "Accounts and categories could not be loaded."}
                  </p>
                  <button
                    type="button"
                    onClick={options.retry}
                    className="mt-5 inline-flex items-center gap-2 rounded-2xl bg-emerald-700 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700"
                  >
                    <RefreshIcon className="h-4 w-4" />
                    Try again
                  </button>
                </div>
              )}

              {options.status === "ready" && options.accounts.length === 0 && (
                <div role="status" className="text-center">
                  <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-50 text-amber-700">
                    <AlertIcon className="h-6 w-6" />
                  </span>
                  <h2 className="mt-4 font-semibold text-stone-950">
                    Add an account first
                  </h2>
                  <p className="mx-auto mt-2 max-w-sm text-sm text-stone-500">
                    Transactions belong to an account. Add an account before
                    recording income or expenses.
                  </p>
                </div>
              )}

              {options.status === "ready" &&
                options.accounts.length > 0 && (
                  <TransactionForm
                    key={formVersion}
                    mode={editingTransaction ? "edit" : "create"}
                    initialValues={initialValues}
                    accounts={options.accounts}
                    categories={options.categories}
                    submitting={submitting}
                    serverError={formError}
                    onSubmit={handleSubmit}
                    onCancelEdit={clearEditing}
                  />
                )}
            </section>
          </div>
        </div>

        <footer className="mt-10 border-t border-stone-200 pt-6 text-center text-xs text-stone-400">
          Finora · Your private financial overview
        </footer>
      </main>
    </div>
  );
}
