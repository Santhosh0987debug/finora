import { useId, useState, type FormEvent } from "react";
import {
  AlertIcon,
  ArrowRightIcon,
  CheckCircleIcon,
  PencilIcon,
  PlusIcon,
} from "./icons";
import {
  validateTransactionForm,
  type TransactionFormErrors,
  type TransactionFormValues,
} from "../lib/transactions";
import { formatAccountType } from "../lib/format";
import type { Account, Category, TransactionMutationType } from "../types/api";

interface TransactionFormProps {
  mode: "create" | "edit";
  initialValues: TransactionFormValues;
  accounts: Account[];
  categories: Category[];
  submitting: boolean;
  serverError: string | null;
  onSubmit: (values: TransactionFormValues) => void;
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

export function TransactionForm({
  mode,
  initialValues,
  accounts,
  categories,
  submitting,
  serverError,
  onSubmit,
  onCancelEdit,
}: TransactionFormProps) {
  const idPrefix = useId();
  const [values, setValues] = useState(initialValues);
  const [errors, setErrors] = useState<TransactionFormErrors>({});
  const isEditing = mode === "edit";
  const visibleCategories = categories.filter(
    (category) => category.type === values.type,
  );

  const changeField = <Key extends keyof TransactionFormValues>(
    key: Key,
    value: TransactionFormValues[Key],
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

  const changeType = (type: TransactionMutationType) => {
    setValues((current) => {
      const selectedCategory = categories.find(
        (category) => category.id === current.categoryId,
      );
      return {
        ...current,
        type,
        categoryId:
          selectedCategory && selectedCategory.type === type
            ? current.categoryId
            : "",
      };
    });
    setErrors({});
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (submitting) {
      return;
    }
    const nextErrors = validateTransactionForm(values, categories);
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
            {isEditing ? "Editing entry" : "New entry"}
          </p>
          <h2 className="mt-1 text-lg font-semibold tracking-tight text-stone-950">
            {isEditing ? "Edit transaction" : "Add transaction"}
          </h2>
          <p className="mt-1 text-sm leading-6 text-stone-500">
            {isEditing
              ? "Update the details and save your changes."
              : "Record income or spending against one of your accounts."}
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
          <span className="text-sm font-medium text-stone-700">
            Transaction type
          </span>
          <div
            className="mt-1.5 grid grid-cols-2 gap-2 rounded-2xl bg-stone-100 p-1"
            role="group"
            aria-label="Transaction type"
          >
            {(["INCOME", "EXPENSE"] as const).map((type) => {
              const selected = values.type === type;
              const selectedTone =
                type === "INCOME"
                  ? "bg-emerald-700 text-white shadow-sm"
                  : "bg-rose-700 text-white shadow-sm";
              return (
                <button
                  key={type}
                  type="button"
                  aria-pressed={selected}
                  onClick={() => changeType(type)}
                  className={`rounded-xl px-3 py-2 text-sm font-semibold transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700 disabled:cursor-not-allowed disabled:opacity-60 ${
                    selected
                      ? selectedTone
                      : "text-stone-600 hover:bg-white hover:text-stone-900"
                  }`}
                >
                  {type === "INCOME" ? "Income" : "Expense"}
                </button>
              );
            })}
          </div>
        </div>

        <div>
          <label
            htmlFor={`${idPrefix}-amount`}
            className="text-sm font-medium text-stone-700"
          >
            Amount
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

        <div>
          <label
            htmlFor={`${idPrefix}-account`}
            className="text-sm font-medium text-stone-700"
          >
            Account
          </label>
          <select
            id={`${idPrefix}-account`}
            name="accountId"
            required
            value={values.accountId}
            onChange={(event) => changeField("accountId", event.target.value)}
            aria-invalid={Boolean(errors.accountId)}
            aria-describedby={
              errors.accountId ? `${idPrefix}-account-error` : undefined
            }
            className={inputClass}
          >
            <option value="">Choose an account</option>
            {accounts.map((account) => (
              <option key={account.id} value={account.id}>
                {account.name} · {formatAccountType(account.type)}
              </option>
            ))}
          </select>
          <FieldError
            id={`${idPrefix}-account-error`}
            message={errors.accountId}
          />
        </div>

        <div>
          <label
            htmlFor={`${idPrefix}-category`}
            className="text-sm font-medium text-stone-700"
          >
            Category <span className="font-normal text-stone-400">optional</span>
          </label>
          <select
            id={`${idPrefix}-category`}
            name="categoryId"
            value={values.categoryId}
            onChange={(event) => changeField("categoryId", event.target.value)}
            aria-invalid={Boolean(errors.categoryId)}
            aria-describedby={
              errors.categoryId ? `${idPrefix}-category-error` : undefined
            }
            className={inputClass}
          >
            <option value="">Uncategorized</option>
            {visibleCategories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </select>
          <FieldError
            id={`${idPrefix}-category-error`}
            message={errors.categoryId}
          />
          {visibleCategories.length === 0 && (
            <p className="mt-1.5 text-xs text-stone-500">
              No {values.type.toLowerCase()} categories are available yet.
            </p>
          )}
        </div>

        <div>
          <label
            htmlFor={`${idPrefix}-date`}
            className="text-sm font-medium text-stone-700"
          >
            Date
          </label>
          <input
            id={`${idPrefix}-date`}
            name="transactionDate"
            type="date"
            required
            value={values.transactionDate}
            onChange={(event) =>
              changeField("transactionDate", event.target.value)
            }
            aria-invalid={Boolean(errors.transactionDate)}
            aria-describedby={
              errors.transactionDate
                ? `${idPrefix}-date-error`
                : undefined
            }
            className={inputClass}
          />
          <FieldError
            id={`${idPrefix}-date-error`}
            message={errors.transactionDate}
          />
        </div>

        <div>
          <label
            htmlFor={`${idPrefix}-description`}
            className="text-sm font-medium text-stone-700"
          >
            Description{" "}
            <span className="font-normal text-stone-400">optional</span>
          </label>
          <textarea
            id={`${idPrefix}-description`}
            name="description"
            rows={3}
            maxLength={500}
            value={values.description}
            onChange={(event) =>
              changeField("description", event.target.value)
            }
            aria-invalid={Boolean(errors.description)}
            aria-describedby={
              errors.description
                ? `${idPrefix}-description-error`
                : `${idPrefix}-description-count`
            }
            className={`${inputClass} resize-y`}
            placeholder="What was this transaction for?"
          />
          <div className="mt-1.5 flex items-start justify-between gap-3">
            <FieldError
              id={`${idPrefix}-description-error`}
              message={errors.description}
            />
            <p
              id={`${idPrefix}-description-count`}
              className="ml-auto text-xs tabular-nums text-stone-400"
            >
              {values.description.length}/500
            </p>
          </div>
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
                {isEditing ? "Saving changes…" : "Adding transaction…"}
              </>
            ) : (
              <>
                {isEditing ? "Save changes" : "Add transaction"}
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
