import type { ReactNode } from "react";

type MetricTone = "balance" | "income" | "expense";

interface MetricCardProps {
  label: string;
  value: string;
  helper: string;
  icon: ReactNode;
  tone: MetricTone;
}

const iconTones: Record<MetricTone, string> = {
  balance: "bg-emerald-50 text-emerald-700",
  income: "bg-teal-50 text-teal-700",
  expense: "bg-rose-50 text-rose-700",
};

const valueTones: Record<MetricTone, string> = {
  balance: "text-stone-950",
  income: "text-emerald-700",
  expense: "text-rose-700",
};

export function MetricCard({
  label,
  value,
  helper,
  icon,
  tone,
}: MetricCardProps) {
  return (
    <article className="rounded-3xl border border-stone-200 bg-white p-5 shadow-sm sm:p-6">
      <div className="flex items-start justify-between gap-4">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-stone-500">
          {label}
        </p>
        <span
          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl ${iconTones[tone]}`}
        >
          {icon}
        </span>
      </div>
      <p
        className={`mt-5 text-3xl font-bold tracking-tight tabular-nums ${valueTones[tone]}`}
      >
        {value}
      </p>
      <p className="mt-2 text-sm text-stone-500">{helper}</p>
    </article>
  );
}
