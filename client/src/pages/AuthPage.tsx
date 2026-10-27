import { useState, type FormEvent } from "react";
import {
  AlertIcon,
  ArrowRightIcon,
  BarChartIcon,
  PieChartIcon,
  ShieldCheckIcon,
  WalletIcon,
} from "../components/icons";

interface AuthPageProps {
  onLogin: (email: string, password: string) => Promise<void>;
  onRegister: (
    name: string,
    email: string,
    password: string,
  ) => Promise<void>;
}

type AuthMode = "login" | "register";

const features = [
  {
    title: "One clear balance",
    description: "See every account and monthly total in a single view.",
    icon: BarChartIcon,
  },
  {
    title: "Spending that makes sense",
    description: "Understand where your money goes by category.",
    icon: PieChartIcon,
  },
  {
    title: "Private by design",
    description: "Your dashboard is protected by your signed-in account.",
    icon: ShieldCheckIcon,
  },
];

export function AuthPage({ onLogin, onRegister }: AuthPageProps) {
  const [mode, setMode] = useState<AuthMode>("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const isRegistering = mode === "register";

  const switchMode = (nextMode: AuthMode) => {
    setMode(nextMode);
    setPassword("");
    setError(null);
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (submitting) {
      return;
    }

    const trimmedName = name.trim();
    const normalizedEmail = email.trim();

    if (isRegistering && trimmedName.length === 0) {
      setError("Enter your name to create an account.");
      return;
    }
    if (normalizedEmail.length === 0) {
      setError("Enter your email address.");
      return;
    }
    if (isRegistering && password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (!isRegistering && password.length === 0) {
      setError("Enter your password.");
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      if (isRegistering) {
        await onRegister(trimmedName, normalizedEmail, password);
      } else {
        await onLogin(normalizedEmail, password);
      }
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Something went wrong. Please try again.",
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="min-h-screen bg-stone-50">
      <div className="grid min-h-screen lg:grid-cols-[1.05fr_1fr]">
        <section className="relative hidden overflow-hidden bg-emerald-950 px-10 py-12 text-white lg:flex lg:flex-col lg:justify-between xl:px-16">
          <div
            className="pointer-events-none absolute -right-28 -top-28 h-96 w-96 rounded-full bg-emerald-700/40 blur-3xl"
            aria-hidden="true"
          />
          <div
            className="pointer-events-none absolute -bottom-40 -left-24 h-96 w-96 rounded-full bg-teal-500/20 blur-3xl"
            aria-hidden="true"
          />

          <div className="relative flex items-center gap-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white/10 text-white ring-1 ring-white/15">
              <WalletIcon className="h-5 w-5" />
            </span>
            <div>
              <p className="text-sm font-bold uppercase tracking-[0.22em]">
                Finora
              </p>
              <p className="text-xs text-emerald-200/80">Personal finance</p>
            </div>
          </div>

          <div className="relative max-w-lg">
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-emerald-300">
              Clarity, not clutter
            </p>
            <h1 className="mt-4 text-4xl font-bold leading-tight tracking-tight xl:text-5xl">
              See your money clearly.
            </h1>
            <p className="mt-5 text-lg leading-8 text-emerald-100/80">
              Keep your balance, monthly cash flow, and spending habits in one
              calm, focused place.
            </p>

            <div className="mt-10 space-y-5">
              {features.map((feature) => {
                const Icon = feature.icon;
                return (
                  <div key={feature.title} className="flex gap-4">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-white/10 text-emerald-200 ring-1 ring-white/10">
                      <Icon className="h-5 w-5" />
                    </span>
                    <div>
                      <p className="font-semibold">{feature.title}</p>
                      <p className="mt-1 text-sm leading-6 text-emerald-100/70">
                        {feature.description}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <p className="relative text-sm text-emerald-200/60">
            Your financial data is only available to your signed-in account.
          </p>
        </section>

        <section className="flex items-center justify-center px-5 py-10 sm:px-8">
          <div className="w-full max-w-md">
            <div className="mb-10 flex items-center gap-3 lg:hidden">
              <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-emerald-700 text-white">
                <WalletIcon className="h-5 w-5" />
              </span>
              <div>
                <p className="text-sm font-bold uppercase tracking-[0.2em] text-emerald-800">
                  Finora
                </p>
                <p className="text-xs text-stone-500">Personal finance</p>
              </div>
            </div>

            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-emerald-700">
              {isRegistering ? "Start your account" : "Welcome back"}
            </p>
            <h2 className="mt-2 text-3xl font-bold tracking-tight text-stone-950">
              {isRegistering ? "Create your Finora account" : "Sign in to Finora"}
            </h2>
            <p className="mt-3 text-sm leading-6 text-stone-500">
              {isRegistering
                ? "Set up your private dashboard in a few seconds."
                : "Use your account details to open your financial dashboard."}
            </p>

            <form onSubmit={handleSubmit} className="mt-8 space-y-5">
              {isRegistering && (
                <div>
                  <label
                    htmlFor="name"
                    className="text-sm font-medium text-stone-700"
                  >
                    Name
                  </label>
                  <input
                    id="name"
                    name="name"
                    type="text"
                    autoComplete="name"
                    required
                    maxLength={100}
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    className="mt-1.5 w-full rounded-2xl border border-stone-200 bg-white px-4 py-3 text-sm text-stone-900 shadow-sm outline-none transition focus:border-emerald-600 focus:ring-4 focus:ring-emerald-700/10"
                    placeholder="Your name"
                  />
                </div>
              )}

              <div>
                <label
                  htmlFor="email"
                  className="text-sm font-medium text-stone-700"
                >
                  Email
                </label>
                <input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  maxLength={254}
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  className="mt-1.5 w-full rounded-2xl border border-stone-200 bg-white px-4 py-3 text-sm text-stone-900 shadow-sm outline-none transition focus:border-emerald-600 focus:ring-4 focus:ring-emerald-700/10"
                  placeholder="you@example.com"
                />
              </div>

              <div>
                <label
                  htmlFor="password"
                  className="text-sm font-medium text-stone-700"
                >
                  Password
                </label>
                <input
                  id="password"
                  name="password"
                  type="password"
                  autoComplete={
                    isRegistering ? "new-password" : "current-password"
                  }
                  required
                  minLength={isRegistering ? 8 : undefined}
                  maxLength={128}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  className="mt-1.5 w-full rounded-2xl border border-stone-200 bg-white px-4 py-3 text-sm text-stone-900 shadow-sm outline-none transition focus:border-emerald-600 focus:ring-4 focus:ring-emerald-700/10"
                  placeholder={
                    isRegistering
                      ? "At least 8 characters"
                      : "Your password"
                  }
                />
              </div>

              {error && (
                <div
                  role="alert"
                  className="flex items-start gap-3 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800"
                >
                  <AlertIcon className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              <button
                type="submit"
                disabled={submitting}
                className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-emerald-700 px-5 py-3.5 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {submitting ? (
                  <>
                    <span
                      className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white"
                      aria-hidden="true"
                    />
                    {isRegistering ? "Creating account…" : "Signing in…"}
                  </>
                ) : (
                  <>
                    {isRegistering ? "Create account" : "Sign in"}
                    <ArrowRightIcon className="h-4 w-4" />
                  </>
                )}
              </button>
            </form>

            <p className="mt-6 text-center text-sm text-stone-500">
              {isRegistering
                ? "Already have an account?"
                : "New to Finora?"}{" "}
              <button
                type="button"
                onClick={() =>
                  switchMode(isRegistering ? "login" : "register")
                }
                disabled={submitting}
                className="font-semibold text-emerald-700 underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700 disabled:opacity-60"
              >
                {isRegistering ? "Sign in" : "Create an account"}
              </button>
            </p>

            <p className="mt-10 text-center text-xs leading-5 text-stone-400">
              Finora never stores your password in the browser. Sign out anytime
              to clear this device&apos;s session.
            </p>
          </div>
        </section>
      </div>
    </main>
  );
}
