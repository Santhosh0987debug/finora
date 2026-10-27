import { useState } from "react";
import { AppHeader } from "../components/AppHeader";
import { BillSnapshot } from "../components/BillSnapshot";
import { BudgetSnapshot } from "../components/BudgetSnapshot";
import { DashboardSkeleton } from "../components/DashboardSkeleton";
import { ExpenseBreakdown } from "../components/ExpenseBreakdown";
import { MetricCard } from "../components/MetricCard";
import { MonthlyOverviewChart } from "../components/MonthlyOverviewChart";
import { PotSnapshot } from "../components/PotSnapshot";
import { RecentTransactions } from "../components/RecentTransactions";
import {
  AlertIcon,
  RefreshIcon,
  TrendDownIcon,
  TrendUpIcon,
  WalletIcon,
} from "../components/icons";
import { useDashboardSummary } from "../hooks/useDashboardSummary";
import { formatMoney } from "../lib/format";
import type { AuthUser } from "../types/api";
import type { AppView } from "../types/navigation";

interface DashboardPageProps {
  user: AuthUser;
  token: string;
  onLogout: () => void;
  onNavigate: (view: AppView) => void;
}

const monthFormatter = new Intl.DateTimeFormat("en-US", {
  month: "long",
  year: "numeric",
  timeZone: "UTC",
});

function greetingForHour(hour: number): string {
  if (hour < 12) {
    return "Good morning";
  }
  if (hour < 18) {
    return "Good afternoon";
  }
  return "Good evening";
}

export function DashboardPage({
  user,
  token,
  onLogout,
  onNavigate,
}: DashboardPageProps) {
  const { data, status, error, retry } = useDashboardSummary(token, onLogout);
  const [pageOpenedAt] = useState(() => new Date());
  const firstName = user.name.trim().split(/\s+/)[0] || "there";
  const greeting = greetingForHour(pageOpenedAt.getHours());

  return (
    <div className="min-h-screen bg-stone-50 text-stone-900">
      <AppHeader
        user={user}
        onLogout={onLogout}
        activeView="dashboard"
        onNavigate={onNavigate}
      />

      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 sm:py-10 lg:px-8">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-700">
              Dashboard
            </p>
            <h1 className="mt-2 text-3xl font-bold tracking-tight text-stone-950 sm:text-4xl">
              {greeting}, {firstName}
            </h1>
            <p className="mt-2 text-sm text-stone-500 sm:text-base">
              Here is how your money is moving this month.
            </p>
          </div>
          <p className="text-sm font-medium text-stone-500">
            {monthFormatter.format(pageOpenedAt)}
          </p>
        </div>

        <div className="mt-8">
          {status === "loading" && <DashboardSkeleton />}

          {status === "error" && (
            <section
              role="alert"
              className="rounded-3xl border border-rose-200 bg-white p-8 text-center shadow-sm sm:p-12"
            >
              <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-rose-50 text-rose-700">
                <AlertIcon className="h-7 w-7" />
              </span>
              <h2 className="mt-5 text-xl font-semibold tracking-tight text-stone-950">
                We could not load your dashboard
              </h2>
              <p className="mx-auto mt-2 max-w-lg text-sm leading-6 text-stone-500">
                {error ?? "Please try again in a moment."}
              </p>
              <button
                type="button"
                onClick={retry}
                className="mt-6 inline-flex items-center gap-2 rounded-2xl bg-emerald-700 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700"
              >
                <RefreshIcon className="h-4 w-4" />
                Try again
              </button>
            </section>
          )}

          {status === "ready" && data && (
            <div className="space-y-6">
              <div className="grid gap-4 md:grid-cols-3">
                <MetricCard
                  label="Total balance"
                  value={formatMoney(data.totalBalance)}
                  helper="Across all accounts"
                  tone="balance"
                  icon={<WalletIcon className="h-5 w-5" />}
                />
                <MetricCard
                  label="Income this month"
                  value={formatMoney(data.totalIncome)}
                  helper="Money received"
                  tone="income"
                  icon={<TrendUpIcon className="h-5 w-5" />}
                />
                <MetricCard
                  label="Expenses this month"
                  value={formatMoney(data.totalExpenses)}
                  helper="Money spent"
                  tone="expense"
                  icon={<TrendDownIcon className="h-5 w-5" />}
                />
              </div>

              <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
                <BudgetSnapshot
                  summary={data.budgetSummary}
                  onManage={() => onNavigate("budgets")}
                />
                <PotSnapshot
                  summary={data.potSummary}
                  onManage={() => onNavigate("pots")}
                />
                <div className="md:col-span-2 xl:col-span-1">
                  <BillSnapshot
                    summary={data.billSummary}
                    onManage={() => onNavigate("bills")}
                  />
                </div>
              </div>

              <div className="grid gap-6 lg:grid-cols-3">
                <div className="lg:col-span-2">
                  <MonthlyOverviewChart data={data.monthlyOverview} />
                </div>
                <ExpenseBreakdown
                  data={data.expenseBreakdown}
                  totalExpenses={data.totalExpenses}
                />
              </div>

              <RecentTransactions
                data={data.recentTransactions}
                onViewAll={() => onNavigate("transactions")}
              />
            </div>
          )}
        </div>

        <footer className="mt-10 border-t border-stone-200 pt-6 text-center text-xs text-stone-400">
          Finora · Your private financial overview
        </footer>
      </main>
    </div>
  );
}
