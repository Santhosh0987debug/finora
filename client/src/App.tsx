import { useState } from "react";
import { AuthPage } from "./pages/AuthPage";
import { BillsPage } from "./pages/BillsPage";
import { BudgetsPage } from "./pages/BudgetsPage";
import { DashboardPage } from "./pages/DashboardPage";
import { PotsPage } from "./pages/PotsPage";
import { TransactionsPage } from "./pages/TransactionsPage";
import { useAuth } from "./hooks/useAuth";
import {
  AlertIcon,
  LogOutIcon,
  RefreshIcon,
  WalletIcon,
} from "./components/icons";
import type { AppView } from "./types/navigation";

function App() {
  const auth = useAuth();
  const [activeView, setActiveView] = useState<AppView>("dashboard");
  const [financeRevision, setFinanceRevision] = useState(0);

  if (auth.status === "checking") {
    return (
      <main
        className="flex min-h-screen items-center justify-center bg-stone-50 px-6"
        role="status"
        aria-live="polite"
      >
        <div className="text-center">
          <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-700 text-white shadow-sm">
            <WalletIcon className="h-6 w-6" />
          </span>
          <p className="mt-4 text-sm font-medium text-stone-600">
            Checking your session…
          </p>
          <span className="sr-only">Loading Finora</span>
        </div>
      </main>
    );
  }

  if (auth.status === "error") {
    return (
      <main className="flex min-h-screen items-center justify-center bg-stone-50 px-5 py-10">
        <section
          role="alert"
          className="w-full max-w-lg rounded-3xl border border-stone-200 bg-white p-8 text-center shadow-sm sm:p-10"
        >
          <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-50 text-amber-700">
            <AlertIcon className="h-7 w-7" />
          </span>
          <h1 className="mt-5 text-2xl font-bold tracking-tight text-stone-950">
            We could not verify your session
          </h1>
          <p className="mt-2 text-sm leading-6 text-stone-500">
            {auth.sessionError ??
              "Check your connection and try again, or sign out to use a different account."}
          </p>
          <div className="mt-6 flex flex-col justify-center gap-3 sm:flex-row">
            <button
              type="button"
              onClick={auth.retrySession}
              className="inline-flex items-center justify-center gap-2 rounded-2xl bg-emerald-700 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700"
            >
              <RefreshIcon className="h-4 w-4" />
              Try again
            </button>
            <button
              type="button"
              onClick={auth.logout}
              className="inline-flex items-center justify-center gap-2 rounded-2xl border border-stone-200 bg-white px-5 py-3 text-sm font-semibold text-stone-600 transition hover:border-stone-300 hover:text-stone-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700"
            >
              <LogOutIcon className="h-4 w-4" />
              Sign out
            </button>
          </div>
        </section>
      </main>
    );
  }

  if (auth.status === "authenticated" && auth.user && auth.token) {
    if (activeView === "transactions") {
      return (
        <TransactionsPage
          user={auth.user}
          token={auth.token}
          onLogout={auth.logout}
          onNavigate={setActiveView}
          onDataChanged={() =>
            setFinanceRevision((revision) => revision + 1)
          }
        />
      );
    }

    if (activeView === "budgets") {
      return (
        <BudgetsPage
          user={auth.user}
          token={auth.token}
          onLogout={auth.logout}
          onNavigate={setActiveView}
          onDataChanged={() =>
            setFinanceRevision((revision) => revision + 1)
          }
        />
      );
    }

    if (activeView === "pots") {
      return (
        <PotsPage
          user={auth.user}
          token={auth.token}
          onLogout={auth.logout}
          onNavigate={setActiveView}
          onDataChanged={() =>
            setFinanceRevision((revision) => revision + 1)
          }
        />
      );
    }

    if (activeView === "bills") {
      return (
        <BillsPage
          user={auth.user}
          token={auth.token}
          onLogout={auth.logout}
          onNavigate={setActiveView}
          onDataChanged={() =>
            setFinanceRevision((revision) => revision + 1)
          }
        />
      );
    }

    return (
      <DashboardPage
        key={financeRevision}
        user={auth.user}
        token={auth.token}
        onLogout={auth.logout}
        onNavigate={setActiveView}
      />
    );
  }

  return <AuthPage onLogin={auth.login} onRegister={auth.register} />;
}

export default App;
