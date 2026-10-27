import { useState, type FormEvent } from "react";
import { formatMoney, toFiniteAmount } from "../lib/format";
import {
  validatePotMovement,
  type PotMovementErrors,
} from "../lib/pots";
import type { PotRecord } from "../types/api";
import {
  AlertIcon,
  ArrowDownLeftIcon,
  ArrowUpRightIcon,
} from "./icons";

interface PotMovementFormProps {
  pot: PotRecord;
  direction: "deposit" | "withdraw";
  submitting: boolean;
  serverError: string | null;
  onSubmit: (amount: string) => void;
  onCancel: () => void;
}

export function PotMovementForm({
  pot,
  direction,
  submitting,
  serverError,
  onSubmit,
  onCancel,
}: PotMovementFormProps) {
  const [amount, setAmount] = useState("");
  const [errors, setErrors] = useState<PotMovementErrors>({});
  const available =
    direction === "deposit"
      ? toFiniteAmount(pot.remaining)
      : toFiniteAmount(pot.currentAmount);
  const isDeposit = direction === "deposit";

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (submitting) {
      return;
    }
    const nextErrors = validatePotMovement(pot, direction, { amount });
    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      return;
    }
    setErrors({});
    onSubmit(amount);
  };

  return (
    <form
      onSubmit={handleSubmit}
      noValidate
      aria-busy={submitting}
      className="mt-3 rounded-2xl border border-emerald-200 bg-emerald-50/60 p-4"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-stone-900">
            {isDeposit ? "Add money" : "Withdraw money"}
          </p>
          <p className="mt-0.5 text-xs text-stone-500">
            {isDeposit
              ? `${formatMoney(available)} remaining to reach this goal.`
              : `${formatMoney(available)} available to withdraw.`}
          </p>
        </div>
        <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-white text-emerald-700 shadow-sm">
          {isDeposit ? (
            <ArrowDownLeftIcon className="h-4 w-4" />
          ) : (
            <ArrowUpRightIcon className="h-4 w-4" />
          )}
        </span>
      </div>

      <fieldset disabled={submitting} className="mt-3">
        <label htmlFor={`movement-${pot.id}`} className="sr-only">
          {isDeposit ? "Amount to add" : "Amount to withdraw"}
        </label>
        <div className="flex gap-2">
          <div className="relative min-w-0 flex-1">
            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm font-semibold text-stone-400">
              $
            </span>
            <input
              id={`movement-${pot.id}`}
              name="movementAmount"
              type="text"
              inputMode="decimal"
              autoComplete="off"
              required
              autoFocus
              value={amount}
              onChange={(event) => {
                setAmount(event.target.value);
                setErrors({});
              }}
              aria-invalid={Boolean(errors.amount)}
              aria-describedby={
                errors.amount ? `movement-${pot.id}-error` : undefined
              }
              className="w-full rounded-xl border border-emerald-200 bg-white py-2.5 pl-7 pr-3 text-sm text-stone-900 shadow-sm outline-none transition focus:border-emerald-600 focus:ring-4 focus:ring-emerald-700/10 disabled:cursor-not-allowed disabled:bg-stone-50"
              placeholder="0.00"
            />
          </div>
          <button
            type="button"
            onClick={() => {
              setAmount(String(available));
              setErrors({});
            }}
            disabled={submitting || available <= 0}
            className="shrink-0 rounded-xl border border-emerald-200 bg-white px-2.5 py-2 text-xs font-semibold text-emerald-700 transition hover:border-emerald-300 hover:bg-emerald-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {isDeposit ? "Use remaining" : "All saved"}
          </button>
        </div>
        {errors.amount && (
          <p
            id={`movement-${pot.id}-error`}
            className="mt-1.5 text-xs font-medium text-rose-700"
          >
            {errors.amount}
          </p>
        )}
        {serverError && (
          <p
            role="alert"
            className="mt-2 flex items-start gap-1.5 text-xs font-medium text-rose-700"
          >
            <AlertIcon className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            {serverError}
          </p>
        )}
        <div className="mt-3 flex gap-2">
          <button
            type="submit"
            className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-emerald-700 px-3 py-2 text-xs font-semibold text-white transition hover:bg-emerald-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {submitting && (
              <span
                className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/30 border-t-white"
                aria-hidden="true"
              />
            )}
            {submitting
              ? "Updating…"
              : isDeposit
                ? "Add money"
                : "Withdraw money"}
          </button>
          <button
            type="button"
            onClick={onCancel}
            disabled={submitting}
            className="rounded-xl border border-stone-200 bg-white px-3 py-2 text-xs font-semibold text-stone-600 transition hover:border-stone-300 hover:text-stone-900 disabled:cursor-not-allowed disabled:opacity-60"
          >
            Cancel
          </button>
        </div>
      </fieldset>
    </form>
  );
}
