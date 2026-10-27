import type { AuthUser } from "../types/api";
import type { AppView } from "../types/navigation";
import { getInitials } from "../lib/format";
import {
  BarChartIcon,
  BellIcon,
  LogOutIcon,
  PiggyBankIcon,
  ReceiptIcon,
  TargetIcon,
  WalletIcon,
} from "./icons";

interface AppHeaderProps {
  user: AuthUser;
  onLogout: () => void;
  activeView: AppView;
  onNavigate: (view: AppView) => void;
}

const navigation: Array<{
  view: AppView;
  label: string;
  icon: typeof BarChartIcon;
}> = [
  { view: "dashboard", label: "Dashboard", icon: BarChartIcon },
  { view: "transactions", label: "Transactions", icon: ReceiptIcon },
  { view: "budgets", label: "Budgets", icon: TargetIcon },
  { view: "pots", label: "Pots", icon: PiggyBankIcon },
  { view: "bills", label: "Bills", icon: BellIcon },
];

export function AppHeader({
  user,
  onLogout,
  activeView,
  onNavigate,
}: AppHeaderProps) {
  return (
    <header className="sticky top-0 z-10 border-b border-stone-200/80 bg-stone-50/90 backdrop-blur">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-3 px-4 py-4 sm:px-6 lg:px-8">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-emerald-700 text-white shadow-sm">
            <WalletIcon className="h-5 w-5" />
          </span>
          <div>
            <p className="text-sm font-bold uppercase tracking-[0.2em] text-emerald-800">
              Finora
            </p>
            <p className="text-xs text-stone-500">Personal finance</p>
          </div>
        </div>

        <nav
          aria-label="Primary"
          className="order-3 flex w-full gap-1 rounded-2xl border border-stone-200 bg-white p-1 shadow-sm sm:order-none sm:ml-4 sm:w-auto"
        >
          {navigation.map((item) => {
            const Icon = item.icon;
            const active = activeView === item.view;
            return (
              <button
                key={item.view}
                type="button"
                onClick={() => onNavigate(item.view)}
                aria-current={active ? "page" : undefined}
                aria-label={item.label}
                className={`inline-flex flex-1 items-center justify-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700 sm:flex-none ${
                  active
                    ? "bg-emerald-700 text-white shadow-sm"
                    : "text-stone-600 hover:bg-stone-50 hover:text-stone-900"
                }`}
              >
                <Icon className="h-4 w-4" />
                <span className="hidden sm:inline">{item.label}</span>
              </button>
            );
          })}
        </nav>

        <div className="ml-auto flex items-center gap-2 sm:gap-3">
          <div className="hidden items-center gap-3 rounded-full border border-stone-200 bg-white py-1.5 pl-1.5 pr-4 sm:flex">
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-100 text-xs font-bold text-emerald-800">
              {getInitials(user.name)}
            </span>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-stone-800">
                {user.name}
              </p>
              <p className="truncate text-xs text-stone-500">{user.email}</p>
            </div>
          </div>

          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-emerald-100 text-xs font-bold text-emerald-800 sm:hidden">
            {getInitials(user.name)}
          </span>

          <button
            type="button"
            onClick={onLogout}
            className="inline-flex items-center gap-2 rounded-full border border-stone-200 bg-white px-3 py-2 text-sm font-medium text-stone-600 transition-colors hover:border-stone-300 hover:text-stone-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700"
            aria-label="Sign out"
          >
            <LogOutIcon className="h-4 w-4" />
            <span className="hidden md:inline">Sign out</span>
          </button>
        </div>
      </div>
    </header>
  );
}
