import type { PotRecord } from "../types/api";
import { formatMoney, formatPercent, formatTransactionDate, toFiniteAmount } from "../lib/format";
import { potProgressWidth } from "../lib/pots";
import {
  ArrowDownLeftIcon,
  ArrowUpRightIcon,
  CheckCircleIcon,
  PencilIcon,
  PiggyBankIcon,
  TrashIcon,
} from "./icons";
import { PotMovementForm } from "./PotMovementForm";

interface PotCardProps {
  pot: PotRecord;
  isEditing: boolean;
  confirmingDelete: boolean;
  deleting: boolean;
  movementDirection: "deposit" | "withdraw" | null;
  movementSubmitting: boolean;
  movementError: string | null;
  actionsDisabled: boolean;
  onEdit: (pot: PotRecord) => void;
  onRequestDelete: (id: string) => void;
  onCancelDelete: () => void;
  onConfirmDelete: (id: string) => void;
  onStartMovement: (
    pot: PotRecord,
    direction: "deposit" | "withdraw",
  ) => void;
  onCancelMovement: () => void;
  onMovementSubmit: (amount: string) => void;
}

export function PotCard({
  pot,
  isEditing,
  confirmingDelete,
  deleting,
  movementDirection,
  movementSubmitting,
  movementError,
  actionsDisabled,
  onEdit,
  onRequestDelete,
  onCancelDelete,
  onConfirmDelete,
  onStartMovement,
  onCancelMovement,
  onMovementSubmit,
}: PotCardProps) {
  const saved = toFiniteAmount(pot.currentAmount);
  const remaining = toFiniteAmount(pot.remaining);
  const progress = potProgressWidth(pot.percentage);
  const dateLabel = pot.targetDate
    ? formatTransactionDate(`${pot.targetDate}T00:00:00.000Z`)
    : null;

  return (
    <article
      className={`px-5 py-5 transition sm:px-6 ${
        isEditing ? "bg-emerald-50/40" : "bg-white"
      }`}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex min-w-0 items-start gap-3">
          <span
            className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl ${
              pot.isComplete
                ? "bg-emerald-700 text-white"
                : "bg-emerald-50 text-emerald-700"
            }`}
          >
            {pot.isComplete ? (
              <CheckCircleIcon className="h-5 w-5" />
            ) : (
              <PiggyBankIcon className="h-5 w-5" />
            )}
          </span>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="truncate font-semibold text-stone-950">
                {pot.name}
              </h3>
              {pot.isComplete && (
                <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-semibold text-emerald-800">
                  Goal reached
                </span>
              )}
            </div>
            <p className="mt-1 text-xs text-stone-500">
              {dateLabel ? `Target ${dateLabel}` : "No target date"}
            </p>
          </div>
        </div>
        <p className="shrink-0 text-sm font-semibold text-stone-900">
          {formatPercent(pot.percentage)}
        </p>
      </div>

      <div className="mt-4">
        <div
          role="progressbar"
          aria-label={`${pot.name} savings progress`}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={pot.percentage}
          className="h-2.5 overflow-hidden rounded-full bg-stone-100"
        >
          <div
            className={`h-full rounded-full transition-all ${
              pot.isComplete
                ? "bg-emerald-700"
                : "bg-gradient-to-r from-emerald-600 to-emerald-500"
            }`}
            style={{ width: `${progress}%` }}
          />
        </div>
        <div className="mt-2 flex items-baseline justify-between gap-3 text-xs text-stone-500">
          <span>
            <strong className="font-semibold text-stone-800">
              {formatMoney(saved)}
            </strong>{" "}
            saved of {formatMoney(pot.targetAmount)}
          </span>
          <span>
            {pot.isComplete
              ? "Complete"
              : `${formatMoney(remaining)} to go`}
          </span>
        </div>
      </div>

      {!pot.isComplete && (
        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => onStartMovement(pot, "deposit")}
            disabled={actionsDisabled}
            className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-700 px-3 py-2 text-xs font-semibold text-white transition hover:bg-emerald-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <ArrowDownLeftIcon className="h-3.5 w-3.5" />
            Add money
          </button>
          <button
            type="button"
            onClick={() => onStartMovement(pot, "withdraw")}
            disabled={actionsDisabled || saved <= 0}
            className="inline-flex items-center gap-1.5 rounded-xl border border-stone-200 bg-white px-3 py-2 text-xs font-semibold text-stone-600 transition hover:border-stone-300 hover:text-stone-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <ArrowUpRightIcon className="h-3.5 w-3.5" />
            Withdraw
          </button>
        </div>
      )}

      {pot.isComplete && saved > 0 && (
        <div className="mt-4">
          <button
            type="button"
            onClick={() => onStartMovement(pot, "withdraw")}
            disabled={actionsDisabled}
            className="inline-flex items-center gap-1.5 rounded-xl border border-stone-200 bg-white px-3 py-2 text-xs font-semibold text-stone-600 transition hover:border-stone-300 hover:text-stone-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <ArrowUpRightIcon className="h-3.5 w-3.5" />
            Withdraw
          </button>
        </div>
      )}

      {movementDirection && (
        <PotMovementForm
          key={`${pot.id}-${movementDirection}`}
          pot={pot}
          direction={movementDirection}
          submitting={movementSubmitting}
          serverError={movementError}
          onSubmit={onMovementSubmit}
          onCancel={onCancelMovement}
        />
      )}

      {confirmingDelete && (
        <div
          role="group"
          aria-label={`Delete ${pot.name}`}
          className="mt-3 rounded-2xl border border-rose-200 bg-rose-50 p-4"
        >
          <p className="text-sm font-semibold text-rose-900">
            Delete “{pot.name}”?
          </p>
          <p className="mt-1 text-xs text-rose-700">
            This removes the pot and its saved progress. This cannot be undone.
          </p>
          <div className="mt-3 flex gap-2">
            <button
              type="button"
              onClick={() => onConfirmDelete(pot.id)}
              disabled={deleting}
              className="inline-flex items-center gap-1.5 rounded-xl bg-rose-700 px-3 py-2 text-xs font-semibold text-white transition hover:bg-rose-800 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {deleting && (
                <span
                  className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/30 border-t-white"
                  aria-hidden="true"
                />
              )}
              {deleting ? "Deleting…" : "Delete pot"}
            </button>
            <button
              type="button"
              onClick={onCancelDelete}
              disabled={deleting}
              className="rounded-xl border border-rose-200 bg-white px-3 py-2 text-xs font-semibold text-rose-700 transition hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-60"
            >
              Keep pot
            </button>
          </div>
        </div>
      )}

      <div className="mt-4 flex items-center justify-end gap-1 border-t border-stone-100 pt-3">
        <button
          type="button"
          onClick={() => onEdit(pot)}
          disabled={actionsDisabled || isEditing}
          className="inline-flex items-center gap-1.5 rounded-xl px-2.5 py-1.5 text-xs font-semibold text-stone-500 transition hover:bg-stone-100 hover:text-stone-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700 disabled:cursor-not-allowed disabled:opacity-40"
        >
          <PencilIcon className="h-3.5 w-3.5" />
          Edit
        </button>
        <button
          type="button"
          onClick={() => onRequestDelete(pot.id)}
          disabled={actionsDisabled}
          className="inline-flex items-center gap-1.5 rounded-xl px-2.5 py-1.5 text-xs font-semibold text-stone-500 transition hover:bg-rose-50 hover:text-rose-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rose-700 disabled:cursor-not-allowed disabled:opacity-40"
        >
          <TrashIcon className="h-3.5 w-3.5" />
          Delete
        </button>
      </div>
    </article>
  );
}
