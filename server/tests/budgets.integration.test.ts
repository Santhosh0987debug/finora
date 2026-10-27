// Isolated integration test for Step 11 budget CRUD, spending, statuses, and
// dashboard summary. Starts the real server on an isolated port (4105), creates
// two unique test users, and inserts deterministic transactions/budgets directly
// through Prisma. Cleanup deletes exactly those users (cascading to their data).
import { deepStrictEqual, equal, ok } from "node:assert";
import { spawn, spawnSync, type ChildProcess } from "node:child_process";
import path from "node:path";
import { after, before, describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";

dotenv.config();

const serverDir = path.dirname(fileURLToPath(import.meta.url));
const PORT = 4105;
const BASE = `http://127.0.0.1:${PORT}`;
const stamp = Date.now();
const emailA = `step11a+${stamp}@example.com`;
const emailB = `step11b+${stamp}@example.com`;
const password = "budget-test-password-1";

const now = new Date();
const currentPeriod = {
  month: now.getUTCMonth() + 1,
  year: now.getUTCFullYear(),
};
const currentStart = new Date(
  Date.UTC(currentPeriod.year, currentPeriod.month - 1, 1),
);
const nextStart = new Date(
  Date.UTC(currentPeriod.year, currentPeriod.month, 1),
);
const previousStart = new Date(
  Date.UTC(currentPeriod.year, currentPeriod.month - 2, 1),
);
const previousPeriod = {
  month: previousStart.getUTCMonth() + 1,
  year: previousStart.getUTCFullYear(),
};
const nextPeriod = {
  month: nextStart.getUTCMonth() + 1,
  year: nextStart.getUTCFullYear(),
};

let server: ChildProcess | undefined;
let tokenA = "";
let tokenB = "";
let categoriesBefore = -1;
let groceriesId = "";
let diningId = "";
let shoppingId = "";
let travelId = "";
let utilitiesId = "";
let salaryId = "";
let accountId = "";
const budgetIds: Record<string, string> = {};

function periodKey(period: { month: number; year: number }): string {
  return `${period.year}-${String(period.month).padStart(2, "0")}`;
}

function periodQuery(period: { month: number; year: number }): string {
  return `month=${period.month}&year=${period.year}`;
}

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
    // Best effort — test cleanup still removes the unique users.
  }
}

async function request(
  method: string,
  route: string,
  token?: string,
  body?: unknown,
): Promise<{ status: number; body: any }> {
  const headers: Record<string, string> = {};
  if (token !== undefined) {
    headers.Authorization = `Bearer ${token}`;
  }
  if (body !== undefined) {
    headers["Content-Type"] = "application/json";
  }
  const res = await fetch(`${BASE}${route}`, {
    method,
    headers,
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
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

async function register(
  email: string,
): Promise<{ token: string; userId: string }> {
  const res = await fetch(`${BASE}/api/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: "Step Eleven", email, password }),
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
      where: {
        name: {
          in: [
            "Groceries",
            "Dining Out",
            "Shopping",
            "Travel",
            "Utilities",
            "Salary",
          ],
        },
      },
      select: { id: true, name: true },
    });
    categoriesBefore = await prisma.category.count();
    groceriesId =
      categories.find((category) => category.name === "Groceries")?.id ?? "";
    diningId =
      categories.find((category) => category.name === "Dining Out")?.id ?? "";
    shoppingId =
      categories.find((category) => category.name === "Shopping")?.id ?? "";
    travelId =
      categories.find((category) => category.name === "Travel")?.id ?? "";
    utilitiesId =
      categories.find((category) => category.name === "Utilities")?.id ?? "";
    salaryId =
      categories.find((category) => category.name === "Salary")?.id ?? "";
    ok(groceriesId, "seeded category Groceries is required");
    ok(diningId, "seeded category Dining Out is required");
    ok(shoppingId, "seeded category Shopping is required");
    ok(travelId, "seeded category Travel is required");
    ok(utilitiesId, "seeded category Utilities is required");
    ok(salaryId, "seeded category Salary is required");

    const account = await prisma.account.create({
      data: {
        userId: userA.userId,
        name: "Budget Checking",
        type: "CHECKING",
        balance: "1000.00",
      },
    });
    accountId = account.id;

    await Promise.all([
      prisma.transaction.create({
        data: {
          userId: userA.userId,
          accountId,
          categoryId: groceriesId,
          amount: "50.00",
          type: "EXPENSE",
          description: "Groceries at start of month",
          transactionDate: currentStart,
        },
      }),
      prisma.transaction.create({
        data: {
          userId: userA.userId,
          accountId,
          categoryId: groceriesId,
          amount: "40.00",
          type: "EXPENSE",
          description: "Groceries at end of month",
          transactionDate: new Date(nextStart.getTime() - 1),
        },
      }),
      prisma.transaction.create({
        data: {
          userId: userA.userId,
          accountId,
          categoryId: groceriesId,
          amount: "999.00",
          type: "INCOME",
          description: "Income mislabeled with a budget category",
          transactionDate: new Date(currentStart.getTime() + 5 * 86_400_000),
        },
      }),
      prisma.transaction.create({
        data: {
          userId: userA.userId,
          accountId,
          categoryId: diningId,
          amount: "150.00",
          type: "EXPENSE",
          description: "Current month dining",
          transactionDate: new Date(currentStart.getTime() + 2 * 86_400_000),
        },
      }),
      prisma.transaction.create({
        data: {
          userId: userA.userId,
          accountId,
          categoryId: shoppingId,
          amount: "10.00",
          type: "EXPENSE",
          description: "Current month shopping",
          transactionDate: new Date(currentStart.getTime() + 3 * 86_400_000),
        },
      }),
      prisma.transaction.create({
        data: {
          userId: userA.userId,
          accountId,
          categoryId: groceriesId,
          amount: "500.00",
          type: "EXPENSE",
          description: "Previous month groceries",
          transactionDate: new Date(previousStart.getTime() + 86_400_000),
        },
      }),
      prisma.transaction.create({
        data: {
          userId: userA.userId,
          accountId,
          categoryId: groceriesId,
          amount: "700.00",
          type: "EXPENSE",
          description: "Next month groceries",
          transactionDate: nextStart,
        },
      }),
    ]);

    const definitions = [
      {
        key: "groceries",
        categoryId: groceriesId,
        amount: "100.00",
        month: currentPeriod.month,
        year: currentPeriod.year,
      },
      {
        key: "dining",
        categoryId: diningId,
        amount: "100.00",
        month: currentPeriod.month,
        year: currentPeriod.year,
      },
      {
        key: "shopping",
        categoryId: shoppingId,
        amount: "100.00",
        month: currentPeriod.month,
        year: currentPeriod.year,
      },
      {
        key: "utilities",
        categoryId: utilitiesId,
        amount: "100.00",
        month: currentPeriod.month,
        year: currentPeriod.year,
      },
      {
        key: "previousGroceries",
        categoryId: groceriesId,
        amount: "100.00",
        month: previousPeriod.month,
        year: previousPeriod.year,
      },
    ];
    const createdBudgets = await Promise.all(
      definitions.map(({ key: _key, ...data }) =>
        prisma.budget.create({
          data: { userId: userA.userId, ...data },
        }),
      ),
    );
    createdBudgets.forEach((budget, index) => {
      budgetIds[definitions[index].key] = budget.id;
    });
  } finally {
    await prisma.$disconnect();
  }
});

after(async () => {
  stopServer(server);

  const { PrismaClient } = await import("@prisma/client");
  const prisma = new PrismaClient();
  try {
    await prisma.user.deleteMany({
      where: { email: { in: [emailA, emailB] } },
    });
    equal(await prisma.category.count(), categoriesBefore);
  } finally {
    await prisma.$disconnect();
  }
});

describe("budget authentication and isolation", () => {
  it("requires a valid authenticated token", async () => {
    equal((await request("GET", "/api/budgets")).status, 401);
    equal(
      (await request("GET", "/api/budgets", "not-a-valid-token")).status,
      401,
    );
    equal(
      (
        await request("POST", "/api/budgets", undefined, {
          categoryId: groceriesId,
          amount: "100.00",
          month: currentPeriod.month,
          year: currentPeriod.year,
        })
      ).status,
      401,
    );
  });

  it("returns an empty list for another user's period", async () => {
    const result = await request(
      "GET",
      `/api/budgets?${periodQuery(currentPeriod)}`,
      tokenB,
    );
    equal(result.status, 200);
    deepStrictEqual(result.body, {
      period: currentPeriod,
      budgets: [],
    });
  });

  it("does not expose or mutate another user's budget", async () => {
    const id = budgetIds.groceries;
    ok(id);

    equal(
      (await request("GET", `/api/budgets/${id}`, tokenB)).status,
      404,
    );
    equal(
      (
        await request("PATCH", `/api/budgets/${id}`, tokenB, {
          amount: "1.00",
        })
      ).status,
      404,
    );
    equal(
      (await request("DELETE", `/api/budgets/${id}`, tokenB)).status,
      404,
    );

    const read = await request("GET", `/api/budgets/${id}`, tokenA);
    equal(read.status, 200);
    equal(read.body.budget.amount, "100.00");
  });
});

describe("budget list spending and statuses", () => {
  it("defaults to the current UTC month and returns sorted budget DTOs", async () => {
    const result = await request("GET", "/api/budgets", tokenA);
    equal(result.status, 200);
    deepStrictEqual(result.body.period, currentPeriod);
    deepStrictEqual(
      result.body.budgets.map((budget: any) => budget.category.name),
      ["Dining Out", "Groceries", "Shopping", "Utilities"],
    );
    equal(JSON.stringify(result.body).includes("userId"), false);
    equal(JSON.stringify(result.body).includes(emailA), false);

    for (const budget of result.body.budgets) {
      equal(typeof budget.amount, "string");
      equal(typeof budget.spent, "string");
      equal(typeof budget.remaining, "string");
      equal(typeof budget.percentage, "number");
      equal(budget.month, currentPeriod.month);
      equal(budget.year, currentPeriod.year);
      deepStrictEqual(Object.keys(budget.category).sort(), [
        "id",
        "name",
        "type",
      ]);
    }
  });

  it("counts only expenses in the category and UTC month", async () => {
    const result = await request(
      "GET",
      `/api/budgets?${periodQuery(currentPeriod)}`,
      tokenA,
    );
    equal(result.status, 200);
    const byName = new Map(
      result.body.budgets.map((budget: any) => [
        budget.category.name,
        budget,
      ]),
    );

    const groceries = byName.get("Groceries");
    ok(groceries);
    equal(groceries.spent, "90.00");
    equal(groceries.remaining, "10.00");
    equal(groceries.percentage, 90);
    equal(groceries.status, "APPROACHING");
    equal(groceries.category.id, groceriesId);

    const dining = byName.get("Dining Out");
    ok(dining);
    equal(dining.spent, "150.00");
    equal(dining.remaining, "-50.00");
    equal(dining.percentage, 150);
    equal(dining.status, "OVER");

    const shopping = byName.get("Shopping");
    ok(shopping);
    equal(shopping.spent, "10.00");
    equal(shopping.percentage, 10);
    equal(shopping.status, "UNDER");

    const utilities = byName.get("Utilities");
    ok(utilities);
    equal(utilities.spent, "0.00");
    equal(utilities.percentage, 0);
    equal(utilities.status, "UNDER");
  });

  it("isolates previous months and returns one owned budget by id", async () => {
    const previous = await request(
      "GET",
      `/api/budgets?${periodQuery(previousPeriod)}`,
      tokenA,
    );
    equal(previous.status, 200);
    deepStrictEqual(previous.body.period, previousPeriod);
    equal(previous.body.budgets.length, 1);
    equal(previous.body.budgets[0].category.name, "Groceries");
    equal(previous.body.budgets[0].spent, "500.00");
    equal(previous.body.budgets[0].status, "OVER");

    const single = await request(
      "GET",
      `/api/budgets/${budgetIds.groceries}`,
      tokenA,
    );
    equal(single.status, 200);
    equal(single.body.budget.spent, "90.00");
    equal(single.body.budget.status, "APPROACHING");
  });
});

describe("dashboard budget summary", () => {
  it("returns current-period budget totals and status counts", async () => {
    const result = await request("GET", "/api/dashboard/summary", tokenA);
    equal(result.status, 200);
    deepStrictEqual(result.body.budgetSummary, {
      month: periodKey(currentPeriod),
      totalLimit: "400.00",
      totalSpent: "250.00",
      totalRemaining: "150.00",
      count: 4,
      underCount: 2,
      approachingCount: 1,
      overCount: 1,
    });
  });

  it("returns a zero budget summary for another user", async () => {
    const result = await request("GET", "/api/dashboard/summary", tokenB);
    equal(result.status, 200);
    deepStrictEqual(result.body.budgetSummary, {
      month: periodKey(currentPeriod),
      totalLimit: "0.00",
      totalSpent: "0.00",
      totalRemaining: "0.00",
      count: 0,
      underCount: 0,
      approachingCount: 0,
      overCount: 0,
    });
  });
});

describe("budget validation and conflicts", () => {
  it("rejects invalid amounts, periods, categories, and unknown fields", async () => {
    const base = {
      categoryId: groceriesId,
      amount: "100.00",
      month: currentPeriod.month,
      year: currentPeriod.year,
    };

    const invalidPayloads = [
      { ...base, amount: "0" },
      { ...base, amount: "-1.00" },
      { ...base, amount: "1.234" },
      { ...base, month: 13 },
      { ...base, month: 0 },
      { ...base, year: 1969 },
      { ...base, categoryId: salaryId },
      { ...base, categoryId: "missing-category-id" },
      { ...base, userId: "attacker" },
      { amount: "100.00", month: currentPeriod.month, year: currentPeriod.year },
    ];
    for (const payload of invalidPayloads) {
      const result = await request("POST", "/api/budgets", tokenA, payload);
      equal(result.status, 400, JSON.stringify(payload));
    }

    equal(
      (
        await request("PATCH", `/api/budgets/${budgetIds.groceries}`, tokenA, {})
      ).status,
      400,
    );
    equal(
      (
        await request(
          "PATCH",
          `/api/budgets/${budgetIds.groceries}`,
          tokenA,
          { categoryId: salaryId },
        )
      ).status,
      400,
    );
    equal(
      (
        await request("GET", "/api/budgets?month=13&year=2026", tokenA)
      ).status,
      400,
    );
  });

  it("returns 409 for a duplicate category and month", async () => {
    const result = await request("POST", "/api/budgets", tokenA, {
      categoryId: groceriesId,
      amount: "100.00",
      month: currentPeriod.month,
      year: currentPeriod.year,
    });
    equal(result.status, 409);
  });
});

describe("budget create, update, and delete", () => {
  it("supports a full CRUD flow in an isolated future month", async () => {
    let travelBudgetId = "";
    let shoppingBudgetId = "";
    try {
      const created = await request("POST", "/api/budgets", tokenA, {
        categoryId: travelId,
        amount: "200.00",
        month: nextPeriod.month,
        year: nextPeriod.year,
      });
      equal(created.status, 201);
      equal(created.body.budget.category.name, "Travel");
      equal(created.body.budget.amount, "200.00");
      equal(created.body.budget.spent, "0.00");
      equal(created.body.budget.status, "UNDER");
      equal(created.body.budget.month, nextPeriod.month);
      equal(created.body.budget.year, nextPeriod.year);
      travelBudgetId = created.body.budget.id;
      ok(travelBudgetId);

      const updated = await request(
        "PATCH",
        `/api/budgets/${travelBudgetId}`,
        tokenA,
        { amount: "250.50" },
      );
      equal(updated.status, 200);
      equal(updated.body.budget.amount, "250.50");
      equal(updated.body.budget.percentage, 0);

      const read = await request(
        "GET",
        `/api/budgets/${travelBudgetId}`,
        tokenA,
      );
      equal(read.status, 200);
      equal(read.body.budget.amount, "250.50");

      const shopping = await request("POST", "/api/budgets", tokenA, {
        categoryId: shoppingId,
        amount: "50.00",
        month: nextPeriod.month,
        year: nextPeriod.year,
      });
      equal(shopping.status, 201);
      shoppingBudgetId = shopping.body.budget.id;

      const conflict = await request(
        "PATCH",
        `/api/budgets/${travelBudgetId}`,
        tokenA,
        { categoryId: shoppingId },
      );
      equal(conflict.status, 409);

      const removed = await request(
        "DELETE",
        `/api/budgets/${travelBudgetId}`,
        tokenA,
      );
      equal(removed.status, 204);
      equal(
        (
          await request("GET", `/api/budgets/${travelBudgetId}`, tokenA)
        ).status,
        404,
      );
      equal(
        (
          await request("DELETE", `/api/budgets/${travelBudgetId}`, tokenA)
        ).status,
        404,
      );
      travelBudgetId = "";

      const removedShopping = await request(
        "DELETE",
        `/api/budgets/${shoppingBudgetId}`,
        tokenA,
      );
      equal(removedShopping.status, 204);
      shoppingBudgetId = "";

      const future = await request(
        "GET",
        `/api/budgets?${periodQuery(nextPeriod)}`,
        tokenA,
      );
      equal(future.status, 200);
      deepStrictEqual(future.body.budgets, []);
    } finally {
      const { PrismaClient } = await import("@prisma/client");
      const prisma = new PrismaClient();
      try {
        const ids = [travelBudgetId, shoppingBudgetId].filter(Boolean);
        if (ids.length > 0) {
          await prisma.budget.deleteMany({ where: { id: { in: ids } } });
        }
      } finally {
        await prisma.$disconnect();
      }
    }
  });
});
