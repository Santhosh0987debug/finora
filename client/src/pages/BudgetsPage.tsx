import { useEffect, useMemo, useRef, useState } from "react";
import { ApiError } from "../api/client";
import {
  createBudget,
  deleteBudget,
  updateBudget,
} from "../api/budgets";
import { AppHeader } from "../components/AppHeader";
import { BudgetForm } from "../components/BudgetForm";
import { BudgetList } from "../components/BudgetList";
import { BudgetPeriodPicker } from "../components/BudgetPeriodPicker";
import { BudgetSummaryCards } from "../components/BudgetSummaryCards";
import {
  AlertIcon,
  CheckCircleIcon,
  CloseIcon,
  RefreshIcon,
  TargetIcon,
} from "../components/icons";
import { useBudgets } from "../hooks/useBudgets";
import { useExpenseCategories } from "../hooks/useBudgetCategories";
import {
  budgetPeriodLabel,
  currentUtcBudgetPeriod,
  emptyBudgetForm,
  formValuesFromBudget,
  shiftBudgetPeriod,
  toBudgetMutationInput,
  type BudgetFormValues,
} from "../lib/budgets";
import { formatMoney } from "../lib/format";
import type {
  AuthUser,
  BudgetRecord,
  Category,
} from "../types/api";
import type { AppView } from "../types/navigation";

interface BudgetsPageProps {
  user: AuthUser;
  token: string;
  onLogout: () => void;
  onNavigate: (view: AppView) => void;
  onDataChanged: () => void;
}

function BudgetListSkeleton() {
  return (
    <div
      className="animate-pulse px-5 py-5 sm:px-6"
      role="status"
      aria-live="polite"
      aria-label="Loading budgets"
    >
      <span className="sr-only">Loading budgets…</span>
      <div className="space-y-5">
        {[0, 1, 2].map((item) => (
          <div key={item} className="space-y-4 py-2">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 shrink-0 rounded-2xl bg-stone-100" />
              <div className="min-w-0 flex-1 space-y-2">
                <div className="h-3.5 w-36 max-w-full rounded-full bg-stone-200" />
                <div className="h-3 w-52 max-w-full rounded-full bg-stone-100" />
              </div>
            </div>
            <div className="h-16 rounded-2xl bg-stone-50" />
            <div className="h-2 rounded-full bg-stone-100" />
          </div>
        ))}
      </div>
    </div>
  );
}

export function BudgetsPage({
  user,
  token,
  onLogout,
  onNavigate,
  onDataChanged,
}: BudgetsPageProps) {
  const [currentPeriod] = useState(currentUtcBudgetPeriod);
  const [period, setPeriod] = useState(currentPeriod);
  const list = useBudgets(token, period, onLogout);
  const options = useExpenseCategories(token, onLogout);
  const [formVersion, setFormVersion] = useState(0);
  const [editingBudget, setEditingBudget] = useState<BudgetRecord | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [confirmingDeleteId, setConfirmingDeleteId] = useState<string | null>(
    null,
  );
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const formSectionRef = useRef<HTMLDivElement>(null);

  const budgets = list.data?.budgets ?? [];
  const periodLabel = budgetPeriodLabel(period);

  const formCategories = useMemo<Category[]>(() => {
    const available = [...options.categories];
    if (
      editingBudget &&
      !available.some((category) => category.id === editingBudget.categoryId)
    ) {
      available.push(editingBudget.category);
    }
    return available.sort((left, right) =>
      left.name.localeCompare(right.name),
    );
  }, [options.categories, editingBudget]);

  useEffect(() => {
    if (!editingBudget) {
      return;
    }
    formSectionRef.current?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  }, [editingBudget]);

  const initialValues = editingBudget
    ? formValuesFromBudget(editingBudget)
    : emptyBudgetForm();

  const clearEditing = () => {
    setEditingBudget(null);
    setFormError(null);
    setFormVersion((version) => version + 1);
  };

  const handlePeriodChange = (nextPeriod: typeof period) => {
    setPeriod(nextPeriod);
    setEditingBudget(null);
    setFormError(null);
    setActionError(null);
    setSuccessMessage(null);
    setConfirmingDeleteId(null);
    setFormVersion((version) => version + 1);
  };

  const handleEdit = (budget: BudgetRecord) => {
    setActionError(null);
    setSuccessMessage(null);
    setConfirmingDeleteId(null);
    setFormError(null);
    setEditingBudget(budget);
    setFormVersion((version) => version + 1);
  };

  const handleSubmit = async (values: BudgetFormValues) => {
    if (submitting) {
      return;
    }
    setSubmitting(true);
    setFormError(null);
    setActionError(null);
    setSuccessMessage(null);

    try {
      const input = toBudgetMutationInput(values, period);
      const saved = editingBudget
        ? await updateBudget(token, editingBudget.id, input)
        : await createBudget(token, input);
      setSuccessMessage(
        editingBudget
          ? `${saved.category.name} budget updated to ${formatMoney(saved.amount)}.`
          : `${saved.category.name} budget added with a ${formatMoney(saved.amount)} limit.`,
      );
      setEditingBudget(null);
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
          : "Could not save this budget.",
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
      await deleteBudget(token, id);
      if (editingBudget?.id === id) {
        setEditingBudget(null);
        setFormVersion((version) => version + 1);
        setFormError(null);
      }
      setConfirmingDeleteId(null);
      setSuccessMessage("Budget deleted.");
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
          : "Could not delete this budget.",
      );
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="min-h-screen bg-stone-50 text-stone-900">
      <AppHeader
        user={user}
        onLogout={onLogout}
        activeView="budgets"
        onNavigate={onNavigate}
      />

      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 sm:py-10 lg:px-8">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-700">
              Budgets
            </p>
            <h1 className="mt-2 text-3xl font-bold tracking-tight text-stone-950 sm:text-4xl">
              Give every category a finish line.
            </h1>
            <p className="mt-2 max-w-2xl text-sm text-stone-500 sm:text-base">
              Set monthly limits and see how spending tracks against them.
            </p>
          </div>
          <BudgetPeriodPicker
            period={period}
            currentPeriod={currentPeriod}
            onChange={handlePeriodChange}
            onPrevious={() =>
              handlePeriodChange(shiftBudgetPeriod(period, -1))
            }
            onNext={() => handlePeriodChange(shiftBudgetPeriod(period, 1))}
          />
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

        {list.status === "ready" && budgets.length > 0 && (
          <div className="mt-6">
            <BudgetSummaryCards budgets={budgets} />
          </div>
        )}

        <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1fr)_390px]">
          <div className="order-2 space-y-6 xl:order-1">
            <section className="overflow-hidden rounded-3xl border border-stone-200 bg-white shadow-sm">
              <div className="flex items-start justify-between gap-4 px-5 pb-4 pt-5 sm:px-6 sm:pt-6">
                <div>
                  <h2 className="text-lg font-semibold tracking-tight text-stone-950">
                    Category budgets
                  </h2>
                  <p className="mt-1 text-sm text-stone-500">
                    {periodLabel} · spending from expense transactions
                  </p>
                </div>
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-stone-100 text-stone-500">
                  <TargetIcon className="h-5 w-5" />
                </span>
              </div>

              {list.status === "loading" && <BudgetListSkeleton />}

              {list.status === "error" && (
                <div
                  role="alert"
                  className="mx-5 mb-6 rounded-2xl border border-rose-200 bg-rose-50 p-6 text-center sm:mx-6"
                >
                  <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-white text-rose-700">
                    <AlertIcon className="h-6 w-6" />
                  </span>
                  <h3 className="mt-4 font-semibold text-stone-950">
                    We could not load your budgets
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

              {list.status === "ready" && budgets.length === 0 && (
                <div className="flex flex-col items-center justify-center px-5 py-14 text-center">
                  <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-stone-100 text-stone-400">
                    <TargetIcon className="h-6 w-6" />
                  </span>
                  <p className="mt-4 font-medium text-stone-700">
                    No budgets for {periodLabel}
                  </p>
                  <p className="mt-1 max-w-sm text-sm text-stone-500">
                    Choose an expense category and set a monthly limit using
                    the form.
                  </p>
                </div>
              )}

              {list.status === "ready" && budgets.length > 0 && (
                <BudgetList
                  budgets={budgets}
                  editingId={editingBudget?.id ?? null}
                  confirmingDeleteId={confirmingDeleteId}
                  deletingId={deletingId}
                  editDisabled={options.status !== "ready"}
                  onEdit={handleEdit}
                  onRequestDelete={setConfirmingDeleteId}
                  onCancelDelete={() => setConfirmingDeleteId(null)}
                  onConfirmDelete={handleConfirmDelete}
                />
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
                  aria-label="Loading budget form"
                >
                  <span className="sr-only">Loading expense categories…</span>
                  <div className="h-3 w-20 rounded-full bg-stone-200" />
                  <div className="mt-3 h-5 w-32 rounded-full bg-stone-200" />
                  <div className="mt-2 h-3 w-56 rounded-full bg-stone-100" />
                  <div className="mt-6 space-y-4">
                    <div className="h-12 rounded-2xl bg-stone-100" />
                    <div className="h-12 rounded-2xl bg-stone-100" />
                    <div className="h-12 rounded-2xl bg-stone-100" />
                  </div>
                </div>
              )}

              {options.status === "error" && (
                <div role="alert" className="text-center">
                  <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-rose-50 text-rose-700">
                    <AlertIcon className="h-6 w-6" />
                  </span>
                  <h2 className="mt-4 font-semibold text-stone-950">
                    Budget form unavailable
                  </h2>
                  <p className="mx-auto mt-2 max-w-sm text-sm text-stone-500">
                    {options.error ??
                      "Expense categories could not be loaded."}
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

              {options.status === "ready" && formCategories.length === 0 && (
                <div role="status" className="text-center">
                  <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-50 text-amber-700">
                    <AlertIcon className="h-6 w-6" />
                  </span>
                  <h2 className="mt-4 font-semibold text-stone-950">
                    Add an expense category first
                  </h2>
                  <p className="mx-auto mt-2 max-w-sm text-sm text-stone-500">
                    Budgets are tied to expense categories. Add one before
                    setting a monthly limit.
                  </p>
                </div>
              )}

              {options.status === "ready" && formCategories.length > 0 && (
                <BudgetForm
                  key={formVersion}
                  mode={editingBudget ? "edit" : "create"}
                  initialValues={initialValues}
                  categories={formCategories}
                  periodLabel={periodLabel}
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
