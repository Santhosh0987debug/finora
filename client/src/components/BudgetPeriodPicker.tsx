import { budgetPeriodKey, budgetPeriodLabel } from "../lib/budgets";
import type { BudgetPeriod } from "../types/api";
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  RefreshIcon,
} from "./icons";

interface BudgetPeriodPickerProps {
  period: BudgetPeriod;
  currentPeriod: BudgetPeriod;
  onChange: (period: BudgetPeriod) => void;
  onPrevious: () => void;
  onNext: () => void;
}

export function BudgetPeriodPicker({
  period,
  currentPeriod,
  onChange,
  onPrevious,
  onNext,
}: BudgetPeriodPickerProps) {
  const isCurrent =
    budgetPeriodKey(period) === budgetPeriodKey(currentPeriod);

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-stone-200 bg-white p-1.5 shadow-sm">
      <button
        type="button"
        onClick={onPrevious}
        title="Previous month"
        className="inline-flex h-9 w-9 items-center justify-center rounded-xl text-stone-500 transition hover:bg-stone-100 hover:text-stone-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700"
      >
        <ChevronLeftIcon className="h-4 w-4" />
        <span className="sr-only">Previous month</span>
      </button>
      <p className="min-w-[9rem] px-1 text-center text-sm font-semibold text-stone-800">
        {budgetPeriodLabel(period)}
      </p>
      <button
        type="button"
        onClick={onNext}
        title="Next month"
        className="inline-flex h-9 w-9 items-center justify-center rounded-xl text-stone-500 transition hover:bg-stone-100 hover:text-stone-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700"
      >
        <ChevronRightIcon className="h-4 w-4" />
        <span className="sr-only">Next month</span>
      </button>
      {!isCurrent && (
        <button
          type="button"
          onClick={() => onChange(currentPeriod)}
          className="inline-flex items-center gap-1.5 rounded-xl bg-stone-100 px-2.5 py-2 text-xs font-semibold text-stone-600 transition hover:bg-stone-200 hover:text-stone-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700"
        >
          <RefreshIcon className="h-3.5 w-3.5" />
          Current month
        </button>
      )}
    </div>
  );
}
