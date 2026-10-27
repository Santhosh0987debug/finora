import { useId, useState, type FormEvent } from "react";
import {
  AlertIcon,
  ArrowRightIcon,
  CheckCircleIcon,
  PencilIcon,
  PlusIcon,
  TargetIcon,
} from "./icons";
import {
  validateBudgetForm,
  type BudgetFormErrors,
  type BudgetFormValues,
} from "../lib/budgets";
import type { Category } from "../types/api";

interface BudgetFormProps {
  mode: "create" | "edit";
  initialValues: BudgetFormValues;
  categories: Category[];
  periodLabel: string;
  submitting: boolean;
  serverError: string | null;
  onSubmit: (values: BudgetFormValues) => void;
  onCancelEdit: () => void;
}

const inputClass =
  "mt-1.5 w-full rounded-2xl border border-stone-200 bg-white px-4 py-3 text-sm text-stone-900 shadow-sm outline-none transition focus:border-emerald-600 focus:ring-4 focus:ring-emerald-700/10 disabled:cursor-not-allowed disabled:bg-stone-50 disabled:text-stone-400";

function FieldError({ id, message }: { id: string; message?: string }) {
  if (!message) {
    return null;
  }
  return (
    <p id={id} className="mt-1.5 text-xs font-medium text-rose-700">
      {message}
    </p>
  );
}

export function BudgetForm({
  mode,
  initialValues,
  categories,
  periodLabel,
  submitting,
  serverError,
  onSubmit,
  onCancelEdit,
}: BudgetFormProps) {
  const idPrefix = useId();
  const [values, setValues] = useState(initialValues);
  const [errors, setErrors] = useState<BudgetFormErrors>({});
  const isEditing = mode === "edit";

  const changeField = <Key extends keyof BudgetFormValues>(
    key: Key,
    value: BudgetFormValues[Key],
  ) => {
    setValues((current) => ({ ...current, [key]: value }));
    setErrors((current) => {
      if (!current[key]) {
        return current;
      }
      const next = { ...current };
      delete next[key];
      return next;
    });
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (submitting) {
      return;
    }
    const nextErrors = validateBudgetForm(values, categories);
    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      return;
    }
    setErrors({});
    onSubmit(values);
  };

  return (
    <form onSubmit={handleSubmit} noValidate aria-busy={submitting}>
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-emerald-700">
            {isEditing ? "Editing budget" : "New budget"}
          </p>
          <h2 className="mt-1 text-lg font-semibold tracking-tight text-stone-950">
            {isEditing ? "Edit budget" : "Add budget"}
          </h2>
          <p className="mt-1 text-sm leading-6 text-stone-500">
            {isEditing
              ? `Update this category limit for ${periodLabel}.`
              : `Set a spending limit for ${periodLabel}.`}
          </p>
        </div>
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700">
          {isEditing ? (
            <PencilIcon className="h-5 w-5" />
          ) : (
            <PlusIcon className="h-5 w-5" />
          )}
        </span>
      </div>

      <fieldset disabled={submitting} className="mt-6 space-y-5">
        <div>
          <label
            htmlFor={`${idPrefix}-category`}
            className="text-sm font-medium text-stone-700"
          >
            Expense category
          </label>
          <select
            id={`${idPrefix}-category`}
            name="categoryId"
            required
            value={values.categoryId}
            onChange={(event) =>
              changeField("categoryId", event.target.value)
            }
            aria-invalid={Boolean(errors.categoryId)}
            aria-describedby={
              errors.categoryId ? `${idPrefix}-category-error` : undefined
            }
            className={inputClass}
          >
            <option value="">Choose a category</option>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </select>
          <FieldError
            id={`${idPrefix}-category-error`}
            message={errors.categoryId}
          />
        </div>

        <div>
          <label
            htmlFor={`${idPrefix}-amount`}
            className="text-sm font-medium text-stone-700"
          >
            Monthly limit
          </label>
          <div className="relative">
            <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-sm font-semibold text-stone-400">
              $
            </span>
            <input
              id={`${idPrefix}-amount`}
              name="amount"
              type="text"
              inputMode="decimal"
              autoComplete="off"
              required
              value={values.amount}
              onChange={(event) => changeField("amount", event.target.value)}
              aria-invalid={Boolean(errors.amount)}
              aria-describedby={
                errors.amount ? `${idPrefix}-amount-error` : undefined
              }
              className={`${inputClass} pl-8`}
              placeholder="0.00"
            />
          </div>
          <FieldError
            id={`${idPrefix}-amount-error`}
            message={errors.amount}
          />
        </div>

        <div className="flex items-start gap-2 rounded-2xl bg-stone-50 px-3 py-2.5 text-xs text-stone-500">
          <TargetIcon className="mt-0.5 h-4 w-4 shrink-0 text-stone-400" />
          <span>
            Spending is calculated from expense transactions in this category
            during {periodLabel}.
          </span>
        </div>

        {serverError && (
          <div
            role="alert"
            className="flex items-start gap-3 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800"
          >
            <AlertIcon className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{serverError}</span>
          </div>
        )}

        <div className="flex flex-col gap-3 pt-1 sm:flex-row">
          <button
            type="submit"
            className="inline-flex flex-1 items-center justify-center gap-2 rounded-2xl bg-emerald-700 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {submitting ? (
              <>
                <span
                  className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white"
                  aria-hidden="true"
                />
                {isEditing ? "Saving changes…" : "Adding budget…"}
              </>
            ) : (
              <>
                {isEditing ? "Save changes" : "Add budget"}
                {isEditing ? (
                  <CheckCircleIcon className="h-4 w-4" />
                ) : (
                  <ArrowRightIcon className="h-4 w-4" />
                )}
              </>
            )}
          </button>
          {isEditing && (
            <button
              type="button"
              onClick={onCancelEdit}
              disabled={submitting}
              className="inline-flex items-center justify-center rounded-2xl border border-stone-200 bg-white px-5 py-3 text-sm font-semibold text-stone-600 transition hover:border-stone-300 hover:text-stone-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              Cancel
            </button>
          )}
        </div>
      </fieldset>
    </form>
  );
}
