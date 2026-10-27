import { useId, useState, type FormEvent } from "react";
import {
  AlertIcon,
  ArrowRightIcon,
  CheckCircleIcon,
  PencilIcon,
  PiggyBankIcon,
  PlusIcon,
} from "./icons";
import {
  validatePotForm,
  type PotFormErrors,
  type PotFormValues,
} from "../lib/pots";

interface PotFormProps {
  mode: "create" | "edit";
  initialValues: PotFormValues;
  submitting: boolean;
  serverError: string | null;
  onSubmit: (values: PotFormValues) => void;
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

export function PotForm({
  mode,
  initialValues,
  submitting,
  serverError,
  onSubmit,
  onCancelEdit,
}: PotFormProps) {
  const idPrefix = useId();
  const [values, setValues] = useState(initialValues);
  const [errors, setErrors] = useState<PotFormErrors>({});
  const isEditing = mode === "edit";

  const changeField = <Key extends keyof PotFormValues>(
    key: Key,
    value: PotFormValues[Key],
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
    const nextErrors = validatePotForm(values);
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
            {isEditing ? "Editing pot" : "New pot"}
          </p>
          <h2 className="mt-1 text-lg font-semibold tracking-tight text-stone-950">
            {isEditing ? "Edit savings pot" : "Create savings pot"}
          </h2>
          <p className="mt-1 text-sm leading-6 text-stone-500">
            {isEditing
              ? "Adjust the goal, saved amount, or target date."
              : "Set a goal, then add money whenever you can."}
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
            htmlFor={`${idPrefix}-name`}
            className="text-sm font-medium text-stone-700"
          >
            Pot name
          </label>
          <input
            id={`${idPrefix}-name`}
            name="name"
            type="text"
            required
            maxLength={100}
            autoComplete="off"
            value={values.name}
            onChange={(event) => changeField("name", event.target.value)}
            aria-invalid={Boolean(errors.name)}
            aria-describedby={
              errors.name ? `${idPrefix}-name-error` : undefined
            }
            className={inputClass}
            placeholder="e.g. Emergency fund"
          />
          <FieldError id={`${idPrefix}-name-error`} message={errors.name} />
        </div>

        <div>
          <label
            htmlFor={`${idPrefix}-target`}
            className="text-sm font-medium text-stone-700"
          >
            Target amount
          </label>
          <div className="relative">
            <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-sm font-semibold text-stone-400">
              $
            </span>
            <input
              id={`${idPrefix}-target`}
              name="targetAmount"
              type="text"
              inputMode="decimal"
              autoComplete="off"
              required
              value={values.targetAmount}
              onChange={(event) =>
                changeField("targetAmount", event.target.value)
              }
              aria-invalid={Boolean(errors.targetAmount)}
              aria-describedby={
                errors.targetAmount
                  ? `${idPrefix}-target-error`
                  : undefined
              }
              className={`${inputClass} pl-8`}
              placeholder="0.00"
            />
          </div>
          <FieldError
            id={`${idPrefix}-target-error`}
            message={errors.targetAmount}
          />
        </div>

        <div>
          <label
            htmlFor={`${idPrefix}-current`}
            className="text-sm font-medium text-stone-700"
          >
            Current saved
          </label>
          <div className="relative">
            <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-sm font-semibold text-stone-400">
              $
            </span>
            <input
              id={`${idPrefix}-current`}
              name="currentAmount"
              type="text"
              inputMode="decimal"
              autoComplete="off"
              value={values.currentAmount}
              onChange={(event) =>
                changeField("currentAmount", event.target.value)
              }
              aria-invalid={Boolean(errors.currentAmount)}
              aria-describedby={
                errors.currentAmount
                  ? `${idPrefix}-current-error`
                  : undefined
              }
              className={`${inputClass} pl-8`}
              placeholder="0.00"
            />
          </div>
          <FieldError
            id={`${idPrefix}-current-error`}
            message={errors.currentAmount}
          />
        </div>

        <div>
          <label
            htmlFor={`${idPrefix}-date`}
            className="text-sm font-medium text-stone-700"
          >
            Target date{" "}
            <span className="font-normal text-stone-400">(optional)</span>
          </label>
          <input
            id={`${idPrefix}-date`}
            name="targetDate"
            type="date"
            value={values.targetDate}
            onChange={(event) =>
              changeField("targetDate", event.target.value)
            }
            aria-invalid={Boolean(errors.targetDate)}
            aria-describedby={
              errors.targetDate ? `${idPrefix}-date-error` : undefined
            }
            className={inputClass}
          />
          <FieldError
            id={`${idPrefix}-date-error`}
            message={errors.targetDate}
          />
        </div>

        <div className="flex items-start gap-2 rounded-2xl bg-stone-50 px-3 py-2.5 text-xs text-stone-500">
          <PiggyBankIcon className="mt-0.5 h-4 w-4 shrink-0 text-stone-400" />
          <span>
            Pots are separate from account balances. Add or withdraw money from
            the pot card whenever you like.
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
                {isEditing ? "Saving changes…" : "Creating pot…"}
              </>
            ) : (
              <>
                {isEditing ? "Save changes" : "Create pot"}
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
