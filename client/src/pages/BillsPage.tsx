import { useEffect, useRef, useState } from "react";
import {
  createBill,
  deleteBill,
  setBillStatus,
  updateBill,
} from "../api/bills";
import { ApiError } from "../api/client";
import { AppHeader } from "../components/AppHeader";
import { BillForm } from "../components/BillForm";
import { BillList } from "../components/BillList";
import { BillSummaryCards } from "../components/BillSummaryCards";
import {
  AlertIcon,
  BellIcon,
  CheckCircleIcon,
  CloseIcon,
  RefreshIcon,
} from "../components/icons";
import { useBills } from "../hooks/useBills";
import {
  billFormFromRecord,
  emptyBillForm,
  toBillMutationInput,
  type BillFormValues,
} from "../lib/bills";
import type { AuthUser, BillRecord } from "../types/api";
import type { AppView } from "../types/navigation";

interface BillsPageProps {
  user: AuthUser;
  token: string;
  onLogout: () => void;
  onNavigate: (view: AppView) => void;
  onDataChanged: () => void;
}

function BillListSkeleton() {
  return (
    <div
      className="animate-pulse px-5 py-5 sm:px-6"
      role="status"
      aria-live="polite"
      aria-label="Loading recurring bills"
    >
      <span className="sr-only">Loading recurring bills.</span>
      <div className="space-y-6">
        {[0, 1, 2].map((item) => (
          <div key={item} className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 shrink-0 rounded-2xl bg-stone-100" />
              <div className="min-w-0 flex-1 space-y-2">
                <div className="h-3.5 w-40 max-w-full rounded-full bg-stone-200" />
                <div className="h-3 w-24 max-w-full rounded-full bg-stone-100" />
              </div>
              <div className="h-5 w-20 rounded-full bg-stone-100" />
            </div>
            <div className="flex gap-2 border-t border-stone-100 pt-4">
              <div className="h-8 w-24 rounded-xl bg-stone-100" />
              <div className="h-8 w-16 rounded-xl bg-stone-100" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function BillsPage({
  user,
  token,
  onLogout,
  onNavigate,
  onDataChanged,
}: BillsPageProps) {
  const list = useBills(token, onLogout);
  const [formVersion, setFormVersion] = useState(0);
  const [editingBill, setEditingBill] = useState<BillRecord | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [confirmingDeleteId, setConfirmingDeleteId] = useState<string | null>(
    null,
  );
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [statusUpdatingId, setStatusUpdatingId] = useState<string | null>(
    null,
  );
  const formSectionRef = useRef<HTMLDivElement>(null);

  const bills = list.bills ?? [];

  useEffect(() => {
    if (!editingBill) {
      return;
    }
    formSectionRef.current?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  }, [editingBill]);

  const initialValues = editingBill
    ? billFormFromRecord(editingBill)
    : emptyBillForm();

  const clearEditing = () => {
    setEditingBill(null);
    setFormError(null);
    setFormVersion((version) => version + 1);
  };

  const handleEdit = (bill: BillRecord) => {
    setActionError(null);
    setSuccessMessage(null);
    setConfirmingDeleteId(null);
    setFormError(null);
    setEditingBill(bill);
    setFormVersion((version) => version + 1);
  };

  const handleSubmit = async (values: BillFormValues) => {
    if (submitting) {
      return;
    }
    setSubmitting(true);
    setFormError(null);
    setActionError(null);
    setSuccessMessage(null);

    try {
      const input = toBillMutationInput(values);
      const saved = editingBill
        ? await updateBill(token, editingBill.id, input)
        : await createBill(token, input);
      setSuccessMessage(
        editingBill
          ? `${saved.name} updated.`
          : `${saved.name} added to your recurring bills.`,
      );
      setEditingBill(null);
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
          : "Could not save this recurring bill.",
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleTogglePaid = async (bill: BillRecord) => {
    if (statusUpdatingId) {
      return;
    }
    const nextStatus = bill.status === "PAID" ? "UPCOMING" : "PAID";
    setStatusUpdatingId(bill.id);
    setActionError(null);
    setSuccessMessage(null);
    setConfirmingDeleteId(null);

    try {
      const saved = await setBillStatus(token, bill.id, nextStatus);
      setSuccessMessage(
        nextStatus === "PAID"
          ? `${saved.name} marked as paid.`
          : saved.status === "OVERDUE"
            ? `${saved.name} marked unpaid and is now overdue.`
            : `${saved.name} marked as unpaid.`,
      );
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
          : "Could not update this bill's status.",
      );
    } finally {
      setStatusUpdatingId(null);
    }
  };

  const handleRequestDelete = (id: string) => {
    setActionError(null);
    setSuccessMessage(null);
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
      await deleteBill(token, id);
      if (editingBill?.id === id) {
        setEditingBill(null);
        setFormVersion((version) => version + 1);
        setFormError(null);
      }
      setConfirmingDeleteId(null);
      setSuccessMessage("Recurring bill deleted.");
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
          : "Could not delete this recurring bill.",
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
        activeView="bills"
        onNavigate={onNavigate}
      />

      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 sm:py-10 lg:px-8">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-700">
            Recurring bills
          </p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight text-stone-950 sm:text-4xl">
            Keep every due date in sight.
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-stone-500 sm:text-base">
            Track repeating bills, see what is overdue, and mark payments as
            you make them.
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

        {list.status === "ready" && bills.length > 0 && (
          <div className="mt-6">
            <BillSummaryCards bills={bills} />
          </div>
        )}

        <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1fr)_390px]">
          <div className="order-2 xl:order-1">
            <section className="overflow-hidden rounded-3xl border border-stone-200 bg-white shadow-sm">
              <div className="flex items-start justify-between gap-4 px-5 pb-4 pt-5 sm:px-6 sm:pt-6">
                <div>
                  <h2 className="text-lg font-semibold tracking-tight text-stone-950">
                    Your bills
                  </h2>
                  <p className="mt-1 text-sm text-stone-500">
                    {list.status === "ready"
                      ? `${bills.length} recurring bill${
                          bills.length === 1 ? "" : "s"
                        }`
                      : "Overdue bills appear first"}
                  </p>
                </div>
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-stone-100 text-stone-500">
                  <BellIcon className="h-5 w-5" />
                </span>
              </div>

              {list.status === "loading" && <BillListSkeleton />}

              {list.status === "error" && (
                <div
                  role="alert"
                  className="mx-5 mb-6 rounded-2xl border border-rose-200 bg-rose-50 p-6 text-center sm:mx-6"
                >
                  <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-white text-rose-700">
                    <AlertIcon className="h-6 w-6" />
                  </span>
                  <h3 className="mt-4 font-semibold text-stone-950">
                    We could not load your recurring bills
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

              {list.status === "ready" && bills.length === 0 && (
                <div className="flex flex-col items-center justify-center px-5 py-14 text-center">
                  <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-stone-100 text-stone-400">
                    <BellIcon className="h-6 w-6" />
                  </span>
                  <p className="mt-4 font-medium text-stone-700">
                    No recurring bills yet
                  </p>
                  <p className="mt-1 max-w-sm text-sm text-stone-500">
                    Add rent, utilities, subscriptions, or any other repeating
                    payment using the form.
                  </p>
                </div>
              )}

              {list.status === "ready" && bills.length > 0 && (
                <BillList
                  bills={bills}
                  editingId={editingBill?.id ?? null}
                  confirmingDeleteId={confirmingDeleteId}
                  deletingId={deletingId}
                  statusUpdatingId={statusUpdatingId}
                  onEdit={handleEdit}
                  onTogglePaid={handleTogglePaid}
                  onRequestDelete={handleRequestDelete}
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
              <BillForm
                key={formVersion}
                mode={editingBill ? "edit" : "create"}
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
