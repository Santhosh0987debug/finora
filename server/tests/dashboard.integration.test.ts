// Isolated integration test for Step 7 dashboard summary.
// Strategy: starts the real server on an isolated port (4104), creates TWO
// uniquely-named test users, and inserts only the accounts/transactions this
// run needs directly through Prisma so historical dates are deterministic.
// Cleanup deletes exactly those users (cascading to their accounts and
// transactions). Seed categories and all other rows are untouched.
import { deepStrictEqual, equal, ok } from "node:assert";
import { spawn, spawnSync, type ChildProcess } from "node:child_process";
import path from "node:path";
import { after, before, describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";

dotenv.config();

const serverDir = path.dirname(fileURLToPath(import.meta.url));
const PORT = 4104;
const BASE = `http://127.0.0.1:${PORT}`;
const stamp = Date.now();
const emailA = `step7a+${stamp}@example.com`;
const emailB = `step7b+${stamp}@example.com`;
const password = "dashboard-test-password-1";

const now = new Date();
const currentStart = new Date(
  Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1),
);
const nextStart = new Date(
  Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1),
);
const previousStart = new Date(
  Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1),
);
const firstBucketStart = new Date(
  Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 5, 1),
);
const outsideRange = new Date(firstBucketStart.getTime() - 1);

function monthKey(date: Date): string {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(
    2,
    "0",
  )}`;
}

const overviewMonths = Array.from({ length: 6 }, (_, index) => {
  const date = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 5 + index, 1),
  );
  return monthKey(date);
});

let server: ChildProcess | undefined;
let tokenA = "";
let tokenB = "";
let categoriesBefore = -1;
let groceriesId = "";
let diningId = "";
let salaryId = "";
let checkingId = "";
let savingsId = "";
const transactionIds: Record<string, string> = {};

async function waitForHealth(): Promise<void> {
  const deadline = Date.now() + 45_000;
  for (;;) {
    try {
      const res = await fetch(`${BASE}/api/health`);
      if (res.ok) return;
    } catch {
      // Server not up yet.
    }
    if (Date.now() > deadline) {
      throw new Error(
        "Test server did not become healthy. Ensure JWT_SECRET is set in server/.env.",
      );
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
}

function stopServer(proc: ChildProcess | undefined): void {
  if (!proc || proc.exitCode !== null) return;
  try {
    if (process.platform === "win32" && proc.pid !== undefined) {
      spawnSync("taskkill", ["/PID", String(proc.pid), "/T", "/F"], {
        stdio: "ignore",
      });
    } else {
      proc.kill();
    }
  } catch {
    // Best effort — ports are verified free before reporting.
  }
}

async function request(
  method: string,
  route: string,
  token?: string,
): Promise<{ status: number; body: any }> {
  const res = await fetch(`${BASE}${route}`, {
    method,
    headers: token !== undefined ? { Authorization: `Bearer ${token}` } : {},
  });
  const text = await res.text();
  let parsed: any = undefined;
  if (text) {
    try {
      parsed = JSON.parse(text);
    } catch {
      parsed = text;
    }
  }
  return { status: res.status, body: parsed };
}

async function register(email: string): Promise<{ token: string; userId: string }> {
  const res = await fetch(`${BASE}/api/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: "Step Seven", email, password }),
  });
  equal(res.status, 201);
  const body = await res.json();
  return { token: body.token as string, userId: body.user.id as string };
}

before(async () => {
  server = spawn("npx", ["tsx", "src/index.ts"], {
    cwd: serverDir,
    env: { ...process.env, PORT: String(PORT) },
    stdio: "ignore",
    shell: true,
  });
  await waitForHealth();

  const userA = await register(emailA);
  const userB = await register(emailB);
  tokenA = userA.token;
  tokenB = userB.token;

  const { PrismaClient } = await import("@prisma/client");
  const prisma = new PrismaClient();
  try {
    const categories = await prisma.category.findMany({
      where: { name: { in: ["Groceries", "Dining Out", "Salary"] } },
      select: { id: true, name: true },
    });
    categoriesBefore = await prisma.category.count();
    groceriesId =
      categories.find((category) => category.name === "Groceries")?.id ?? "";
    diningId =
      categories.find((category) => category.name === "Dining Out")?.id ?? "";
    salaryId =
      categories.find((category) => category.name === "Salary")?.id ?? "";
    ok(groceriesId, "seeded category Groceries is required");
    ok(diningId, "seeded category Dining Out is required");
    ok(salaryId, "seeded category Salary is required");

    const [checking, savings, credit] = await Promise.all([
      prisma.account.create({
        data: {
          userId: userA.userId,
          name: "Checking",
          type: "CHECKING",
          balance: "1000.00",
        },
      }),
      prisma.account.create({
        data: {
          userId: userA.userId,
          name: "Savings",
          type: "SAVINGS",
          balance: "250.75",
        },
      }),
      prisma.account.create({
        data: {
          userId: userA.userId,
          name: "Credit Card",
          type: "CREDIT_CARD",
          balance: "-50.25",
        },
      }),
    ]);
    checkingId = checking.id;
    savingsId = savings.id;

    const definitions = [
      {
        key: "outsideOld",
        accountId: checkingId,
        categoryId: salaryId,
        amount: "500.00",
        type: "INCOME",
        description: "Outside six-month range",
        transactionDate: outsideRange,
      },
      {
        key: "oldest",
        accountId: checkingId,
        categoryId: salaryId,
        amount: "40.00",
        type: "INCOME",
        description: "Oldest included income",
        transactionDate: firstBucketStart,
      },
      {
        key: "previous",
        accountId: checkingId,
        categoryId: groceriesId,
        amount: "30.00",
        type: "EXPENSE",
        description: "Previous month expense",
        transactionDate: new Date(previousStart.getTime() + 86_400_000),
      },
      {
        key: "currentIncome",
        accountId: checkingId,
        categoryId: salaryId,
        amount: "100.00",
        type: "INCOME",
        description: "Current month income",
        transactionDate: currentStart,
      },
      {
        key: "currentDining",
        accountId: savingsId,
        categoryId: diningId,
        amount: "30.00",
        type: "EXPENSE",
        description: "Current month dining",
        transactionDate: new Date(currentStart.getTime() + 10 * 86_400_000),
      },
      {
        key: "currentUncategorized",
        accountId: checkingId,
        categoryId: null,
        amount: "50.00",
        type: "EXPENSE",
        description: "Uncategorized expense",
        transactionDate: new Date(currentStart.getTime() + 15 * 86_400_000),
      },
      {
        key: "currentGroceries",
        accountId: checkingId,
        categoryId: groceriesId,
        amount: "20.00",
        type: "EXPENSE",
        description: "Latest current-month expense",
        transactionDate: new Date(nextStart.getTime() - 1),
      },
      {
        key: "nextMonth",
        accountId: savingsId,
        categoryId: salaryId,
        amount: "999.00",
        type: "INCOME",
        description: "Next month income",
        transactionDate: nextStart,
      },
    ];

    const created = await Promise.all(
      definitions.map((definition) => {
        const { key: _key, ...data } = definition;
        return prisma.transaction.create({
          data: { userId: userA.userId, ...data },
        });
      }),
    );
    created.forEach((transaction, index) => {
      transactionIds[definitions[index].key] = transaction.id;
    });

    // User B deliberately has no accounts or transactions.
    equal(userB.userId.length > 0, true);
    equal(credit.balance.toFixed(2), "-50.25");
  } finally {
    await prisma.$disconnect();
  }
});

after(async () => {
  stopServer(server);

  const { PrismaClient } = await import("@prisma/client");
  const prisma = new PrismaClient();
  try {
    await prisma.user.deleteMany({ where: { email: { in: [emailA, emailB] } } });
    equal(await prisma.category.count(), categoriesBefore);
  } finally {
    await prisma.$disconnect();
  }
});

describe("dashboard summary authentication", () => {
  it("requires a valid authenticated token", async () => {
    equal((await request("GET", "/api/dashboard/summary")).status, 401);
    equal(
      (
        await request(
          "GET",
          "/api/dashboard/summary",
          "not-a-valid-token",
        )
      ).status,
      401,
    );
  });
});

describe("dashboard summary isolation and empty data", () => {
  it("returns zeros and empty collections for a user with no data", async () => {
    const result = await request("GET", "/api/dashboard/summary", tokenB);
    equal(result.status, 200);
    equal(result.body.totalBalance, "0.00");
    equal(result.body.totalIncome, "0.00");
    equal(result.body.totalExpenses, "0.00");
    deepStrictEqual(result.body.monthlyOverview, [
      ...overviewMonths.map((month) => ({
        month,
        income: "0.00",
        expenses: "0.00",
      })),
    ]);
    deepStrictEqual(result.body.expenseBreakdown, []);
    deepStrictEqual(result.body.recentTransactions, []);
  });

  it("does not leak another user's balances or transactions", async () => {
    const result = await request("GET", "/api/dashboard/summary", tokenB);
    equal(result.status, 200);
    equal(result.body.totalBalance, "0.00");
    equal(result.body.totalIncome, "0.00");
    equal(result.body.totalExpenses, "0.00");
    equal(
      JSON.stringify(result.body).includes(transactionIds.currentIncome),
      false,
    );
    equal(JSON.stringify(result.body).includes(checkingId), false);
  });
});

describe("dashboard summary totals and monthly overview", () => {
  it("returns total balance and current-month totals", async () => {
    const result = await request("GET", "/api/dashboard/summary", tokenA);
    equal(result.status, 200);
    equal(result.body.totalBalance, "1200.50");
    equal(result.body.totalIncome, "100.00");
    equal(result.body.totalExpenses, "100.00");
    equal(JSON.stringify(result.body).includes("passwordHash"), false);
    equal(JSON.stringify(result.body).includes(emailA), false);
  });

  it("returns six chronological months with zero-filled gaps and boundaries", async () => {
    const result = await request("GET", "/api/dashboard/summary", tokenA);
    equal(result.status, 200);

    const expected = overviewMonths.map((month, index) => ({
      month,
      income: index === 0 ? "40.00" : index === 5 ? "100.00" : "0.00",
      expenses: index === 4 ? "30.00" : index === 5 ? "100.00" : "0.00",
    }));
    deepStrictEqual(result.body.monthlyOverview, expected);
    equal(result.body.monthlyOverview.length, 6);
  });
});

describe("dashboard expense breakdown", () => {
  it("groups current-month expenses by category with percentages", async () => {
    const result = await request("GET", "/api/dashboard/summary", tokenA);
    equal(result.status, 200);
    deepStrictEqual(result.body.expenseBreakdown, [
      {
        categoryId: null,
        categoryName: "Uncategorized",
        amount: "50.00",
        percentage: 50,
      },
      {
        categoryId: diningId,
        categoryName: "Dining Out",
        amount: "30.00",
        percentage: 30,
      },
      {
        categoryId: groceriesId,
        categoryName: "Groceries",
        amount: "20.00",
        percentage: 20,
      },
    ]);
  });
});

describe("dashboard recent transactions", () => {
  it("returns the latest five newest-first with account and category details", async () => {
    const result = await request("GET", "/api/dashboard/summary", tokenA);
    equal(result.status, 200);

    const expectedOrder = [
      transactionIds.nextMonth,
      transactionIds.currentGroceries,
      transactionIds.currentUncategorized,
      transactionIds.currentDining,
      transactionIds.currentIncome,
    ];
    deepStrictEqual(
      result.body.recentTransactions.map(
        (transaction: { id: string }) => transaction.id,
      ),
      expectedOrder,
    );
    equal(result.body.recentTransactions.length, 5);

    for (const transaction of result.body.recentTransactions) {
      equal(typeof transaction.amount, "string");
      ok(transaction.account);
      equal(typeof transaction.account.id, "string");
      equal(typeof transaction.account.name, "string");
      equal(typeof transaction.account.type, "string");
      equal(transaction.userId, undefined);
    }

    const newest = result.body.recentTransactions[0];
    equal(newest.amount, "999.00");
    equal(newest.type, "INCOME");
    equal(newest.account.name, "Savings");
    deepStrictEqual(newest.category, {
      id: salaryId,
      name: "Salary",
      type: "INCOME",
    });

    const uncategorized = result.body.recentTransactions.find(
      (transaction: { id: string }) =>
        transaction.id === transactionIds.currentUncategorized,
    );
    ok(uncategorized);
    equal(uncategorized.category, null);
    equal(uncategorized.categoryId, null);
  });
});
