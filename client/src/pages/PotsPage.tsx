import { useEffect, useRef, useState } from "react";
import { ApiError } from "../api/client";
import {
  createPot,
  deletePot,
  movePotMoney,
  updatePot,
} from "../api/pots";
import { AppHeader } from "../components/AppHeader";
import {
  AlertIcon,
  CheckCircleIcon,
  CloseIcon,
  PiggyBankIcon,
  RefreshIcon,
} from "../components/icons";
import { PotForm } from "../components/PotForm";
import { PotList } from "../components/PotList";
import { PotSummaryCards } from "../components/PotSummaryCards";
import { usePots } from "../hooks/usePots";
import { formatMoney } from "../lib/format";
import {
  emptyPotForm,
  potFormFromRecord,
  toPotMutationInput,
  type PotFormValues,
} from "../lib/pots";
import type { AuthUser, PotRecord } from "../types/api";
import type { AppView } from "../types/navigation";

interface PotsPageProps {
  user: AuthUser;
  token: string;
  onLogout: () => void;
  onNavigate: (view: AppView) => void;
  onDataChanged: () => void;
}

function PotListSkeleton() {
  return (
    <div
      className="animate-pulse px-5 py-5 sm:px-6"
      role="status"
      aria-live="polite"
      aria-label="Loading savings pots"
    >
      <span className="sr-only">Loading savings pots…</span>
      <div className="space-y-7">
        {[0, 1, 2].map((item) => (
          <div key={item} className="space-y-4 py-1">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 shrink-0 rounded-2xl bg-stone-100" />
              <div className="min-w-0 flex-1 space-y-2">
                <div className="h-3.5 w-40 max-w-full rounded-full bg-stone-200" />
                <div className="h-3 w-28 max-w-full rounded-full bg-stone-100" />
              </div>
            </div>
            <div className="h-2.5 rounded-full bg-stone-100" />
            <div className="flex gap-2">
              <div className="h-8 w-24 rounded-xl bg-stone-100" />
              <div className="h-8 w-24 rounded-xl bg-stone-100" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function PotsPage({
  user,
  token,
  onLogout,
  onNavigate,
  onDataChanged,
}: PotsPageProps) {
  const list = usePots(token, onLogout);
  const [formVersion, setFormVersion] = useState(0);
  const [editingPot, setEditingPot] = useState<PotRecord | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [confirmingDeleteId, setConfirmingDeleteId] = useState<string | null>(
    null,
  );
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [movement, setMovement] = useState<{
    potId: string;
    direction: "deposit" | "withdraw";
  } | null>(null);
  const [movementSubmitting, setMovementSubmitting] = useState(false);
  const [movementError, setMovementError] = useState<string | null>(null);
  const formSectionRef = useRef<HTMLDivElement>(null);

  const pots = list.pots ?? [];

  useEffect(() => {
    if (!editingPot) {
      return;
    }
    formSectionRef.current?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  }, [editingPot]);

  const initialValues = editingPot
    ? potFormFromRecord(editingPot)
    : emptyPotForm();

  const clearEditing = () => {
    setEditingPot(null);
    setFormError(null);
    setFormVersion((version) => version + 1);
  };

  const handleEdit = (pot: PotRecord) => {
    setActionError(null);
    setSuccessMessage(null);
    setConfirmingDeleteId(null);
    setMovement(null);
    setMovementError(null);
    setFormError(null);
    setEditingPot(pot);
    setFormVersion((version) => version + 1);
  };

  const handleSubmit = async (values: PotFormValues) => {
    if (submitting) {
      return;
    }
    setSubmitting(true);
    setFormError(null);
    setActionError(null);
    setSuccessMessage(null);
    setMovement(null);
    setMovementError(null);

    try {
      const input = toPotMutationInput(values);
      const saved = editingPot
        ? await updatePot(token, editingPot.id, input)
        : await createPot(token, input);
      setSuccessMessage(
        editingPot
          ? `${saved.name} updated.`
          : `${saved.name} created with a ${formatMoney(saved.targetAmount)} goal.`,
      );
      setEditingPot(null);
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
          : "Could not save this savings pot.",
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleRequestDelete = (id: string) => {
    setActionError(null);
    setSuccessMessage(null);
    setMovement(null);
    setMovementError(null);
    setConfirmingDeleteId(id);
  };

  const handleConfirmDelete = async (id: string) => {
    if (deletingId) {
      return;
    }
    setDeletingId(id);
    setActionError(null);
    setSuccessMessage(null);

    try {
      await deletePot(token, id);
      if (editingPot?.id === id) {
        setEditingPot(null);
        setFormVersion((version) => version + 1);
        setFormError(null);
      }
      if (movement?.potId === id) {
        setMovement(null);
        setMovementError(null);
      }
      setConfirmingDeleteId(null);
      setSuccessMessage("Savings pot deleted.");
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
          : "Could not delete this savings pot.",
      );
    } finally {
      setDeletingId(null);
    }
  };

  const handleStartMovement = (
    pot: PotRecord,
    direction: "deposit" | "withdraw",
  ) => {
    setActionError(null);
    setSuccessMessage(null);
    setConfirmingDeleteId(null);
    setMovementError(null);
    setEditingPot(null);
    setMovement({ potId: pot.id, direction });
  };

  const handleMovementSubmit = async (amount: string) => {
    if (!movement || movementSubmitting) {
      return;
    }
    setMovementSubmitting(true);
    setMovementError(null);
    setActionError(null);
    setSuccessMessage(null);

    try {
      const saved = await movePotMoney(
        token,
        movement.potId,
        movement.direction,
        { amount },
      );
      setSuccessMessage(
        movement.direction === "deposit"
          ? `Added ${formatMoney(amount)} to ${saved.name}.`
          : `Withdrew ${formatMoney(amount)} from ${saved.name}.`,
      );
      setMovement(null);
      setConfirmingDeleteId(null);
      list.refresh();
      onDataChanged();
    } catch (caught) {
      if (caught instanceof ApiError && caught.status === 401) {
        onLogout();
        return;
      }
      setMovementError(
        caught instanceof Error
          ? caught.message
          : "Could not update this savings pot.",
      );
    } finally {
      setMovementSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-stone-50 text-stone-900">
      <AppHeader
        user={user}
        onLogout={onLogout}
        activeView="pots"
        onNavigate={onNavigate}
      />

      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 sm:py-10 lg:px-8">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-700">
            Savings pots
          </p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight text-stone-950 sm:text-4xl">
            Turn spare money into progress.
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-stone-500 sm:text-base">
            Create goals, add money as you save, and watch each pot fill up.
          </p>
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

        {list.status === "ready" && pots.length > 0 && (
          <div className="mt-6">
            <PotSummaryCards pots={pots} />
          </div>
        )}

        <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1fr)_390px]">
          <div className="order-2 xl:order-1">
            <section className="overflow-hidden rounded-3xl border border-stone-200 bg-white shadow-sm">
              <div className="flex items-start justify-between gap-4 px-5 pb-4 pt-5 sm:px-6 sm:pt-6">
                <div>
                  <h2 className="text-lg font-semibold tracking-tight text-stone-950">
                    Your goals
                  </h2>
                  <p className="mt-1 text-sm text-stone-500">
                    {list.status === "ready"
                      ? `${pots.length} pot${pots.length === 1 ? "" : "s"}`
                      : "Savings progress at a glance"}
                  </p>
                </div>
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-stone-100 text-stone-500">
                  <PiggyBankIcon className="h-5 w-5" />
                </span>
              </div>

              {list.status === "loading" && <PotListSkeleton />}

              {list.status === "error" && (
                <div
                  role="alert"
                  className="mx-5 mb-6 rounded-2xl border border-rose-200 bg-rose-50 p-6 text-center sm:mx-6"
                >
                  <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-white text-rose-700">
                    <AlertIcon className="h-6 w-6" />
                  </span>
                  <h3 className="mt-4 font-semibold text-stone-950">
                    We could not load your savings pots
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

              {list.status === "ready" && pots.length === 0 && (
                <div className="flex flex-col items-center justify-center px-5 py-14 text-center">
                  <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-stone-100 text-stone-400">
                    <PiggyBankIcon className="h-6 w-6" />
                  </span>
                  <p className="mt-4 font-medium text-stone-700">
                    No savings pots yet
                  </p>
                  <p className="mt-1 max-w-sm text-sm text-stone-500">
                    Create your first goal using the form. You can start with
                    $0 and add money later.
                  </p>
                </div>
              )}

              {list.status === "ready" && pots.length > 0 && (
                <PotList
                  pots={pots}
                  editingId={editingPot?.id ?? null}
                  confirmingDeleteId={confirmingDeleteId}
                  deletingId={deletingId}
                  movement={movement}
                  movementSubmitting={movementSubmitting}
                  movementError={movementError}
                  onEdit={handleEdit}
                  onRequestDelete={handleRequestDelete}
                  onCancelDelete={() => setConfirmingDeleteId(null)}
                  onConfirmDelete={handleConfirmDelete}
                  onStartMovement={handleStartMovement}
                  onCancelMovement={() => {
                    setMovement(null);
                    setMovementError(null);
                  }}
                  onMovementSubmit={handleMovementSubmit}
                />
              )}
            </section>
          </div>

          <div
            ref={formSectionRef}
            className="order-1 scroll-mt-24 xl:order-2"
          >
            <section className="rounded-3xl border border-stone-200 bg-white p-5 shadow-sm sm:p-6 xl:sticky xl:top-24">
              <PotForm
                key={formVersion}
                mode={editingPot ? "edit" : "create"}
                initialValues={initialValues}
                submitting={submitting}
                serverError={formError}
                onSubmit={handleSubmit}
                onCancelEdit={clearEditing}
              />
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
