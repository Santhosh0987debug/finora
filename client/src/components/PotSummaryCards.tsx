import { formatMoney, formatPercent, toFiniteAmount } from "../lib/format";
import type { PotRecord } from "../types/api";
import {
  CheckCircleIcon,
  PiggyBankIcon,
  TargetIcon,
  WalletIcon,
} from "./icons";

interface PotSummaryCardsProps {
  pots: PotRecord[];
}

export function PotSummaryCards({ pots }: PotSummaryCardsProps) {
  const totalSaved = pots.reduce(
    (sum, pot) => sum + toFiniteAmount(pot.currentAmount),
    0,
  );
  const totalTarget = pots.reduce(
    (sum, pot) => sum + toFiniteAmount(pot.targetAmount),
    0,
  );
  const remaining = Math.max(0, totalTarget - totalSaved);
  const percentage =
    totalTarget > 0 ? (totalSaved / totalTarget) * 100 : 0;
  const completed = pots.filter((pot) => pot.isComplete).length;

  return (
    <div className="grid gap-4 sm:grid-cols-3">
      <article className="rounded-3xl border border-stone-200 bg-white p-5 shadow-sm">
        <div className="flex items-start justify-between gap-4">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-stone-500">
            Total saved
          </p>
          <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700">
            <PiggyBankIcon className="h-5 w-5" />
          </span>
        </div>
        <p className="mt-5 text-3xl font-bold tracking-tight tabular-nums text-stone-950">
          {formatMoney(totalSaved)}
        </p>
        <p className="mt-2 text-sm text-stone-500">
          {pots.length} pot{pots.length === 1 ? "" : "s"} · {completed}{" "}
          completed
        </p>
      </article>

      <article className="rounded-3xl border border-stone-200 bg-white p-5 shadow-sm">
        <div className="flex items-start justify-between gap-4">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-stone-500">
            Total target
          </p>
          <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-stone-100 text-stone-600">
            <TargetIcon className="h-5 w-5" />
          </span>
        </div>
        <p className="mt-5 text-3xl font-bold tracking-tight tabular-nums text-stone-950">
          {formatMoney(totalTarget)}
        </p>
        <p className="mt-2 text-sm text-stone-500">
          Across every savings goal
        </p>
      </article>

      <article className="rounded-3xl border border-stone-200 bg-white p-5 shadow-sm">
        <div className="flex items-start justify-between gap-4">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-stone-500">
            Still to save
          </p>
          <span
            className={`flex h-10 w-10 items-center justify-center rounded-2xl ${
              completed === pots.length
                ? "bg-emerald-50 text-emerald-700"
                : "bg-amber-50 text-amber-700"
            }`}
          >
            {completed === pots.length ? (
              <CheckCircleIcon className="h-5 w-5" />
            ) : (
              <WalletIcon className="h-5 w-5" />
            )}
          </span>
        </div>
        <p className="mt-5 text-3xl font-bold tracking-tight tabular-nums text-stone-950">
          {formatMoney(remaining)}
        </p>
        <p className="mt-2 text-sm text-stone-500">
          {formatPercent(percentage)} of targets funded
        </p>
      </article>
    </div>
  );
}
