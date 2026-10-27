// Isolated integration test for Step 6 transactions endpoints.
// Strategy: starts the real server on an isolated port (4103), creates TWO
// uniquely-named test users plus only the accounts/transactions this run
// needs, then deletes exactly those rows in `finally` (users cascade to their
// accounts and transactions). Seed categories and all other rows are
// untouched. Run with: npm run test:integration --workspace=server
import { deepStrictEqual, equal, ok } from "node:assert";
import { spawn, spawnSync, type ChildProcess } from "node:child_process";
import path from "node:path";
import { after, before, describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";

dotenv.config();

const serverDir = path.dirname(fileURLToPath(import.meta.url));
const PORT = 4103;
const BASE = `http://127.0.0.1:${PORT}`;
const stamp = Date.now();
const emailA = `step6a+${stamp}@example.com`;
const emailB = `step6b+${stamp}@example.com`;
const password = "transactions-test-password-1";

let server: ChildProcess | undefined;
let tokenA = "";
let tokenB = "";
let primaryAccountId = "";
let savingsAccountId = "";
let smallAccountId = "";
let concurrentAccountId = "";
let filterAccountId = "";
let accountBId = "";
let incomeCategoryId = "";
let expenseCategoryId = "";
let categoriesBefore = -1;

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
  body?: unknown,
): Promise<{ status: number; body: any }> {
  const res = await fetch(`${BASE}${route}`, {
    method,
    headers: {
      ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
      ...(token !== undefined ? { Authorization: `Bearer ${token}` } : {}),
    },
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

async function register(email: string): Promise<string> {
  const result = await request("POST", "/api/auth/register", undefined, {
    name: "Step Six",
    email,
    password,
  });
  equal(result.status, 201);
  return result.body.token as string;
}

async function createAccount(
  token: string,
  body: Record<string, unknown>,
): Promise<string> {
  const result = await request("POST", "/api/accounts", token, body);
  equal(result.status, 201, JSON.stringify(result.body));
  return result.body.account.id as string;
}

async function balanceOf(token: string, accountId: string): Promise<string> {
  const result = await request("GET", `/api/accounts/${accountId}`, token);
  equal(result.status, 200);
  return result.body.account.balance as string;
}

function transactionQuery(
  params: Record<string, string | number | undefined>,
): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined) search.set(key, String(value));
  }
  return `/api/transactions?${search.toString()}`;
}

before(async () => {
  server = spawn("npx", ["tsx", "src/index.ts"], {
    cwd: serverDir,
    env: { ...process.env, PORT: String(PORT) },
    stdio: "ignore",
    shell: true,
  });
  await waitForHealth();

  tokenA = await register(emailA);
  tokenB = await register(emailB);

  const { PrismaClient } = await import("@prisma/client");
  const prisma = new PrismaClient();
  try {
    const income = await prisma.category.findFirst({
      where: { name: "Salary", type: "INCOME" },
    });
    const expense = await prisma.category.findFirst({
      where: { name: "Groceries", type: "EXPENSE" },
    });
    ok(income, "seeded income category Salary is required");
    ok(expense, "seeded expense category Groceries is required");
    incomeCategoryId = income.id;
    expenseCategoryId = expense.id;
    categoriesBefore = await prisma.category.count();
  } finally {
    await prisma.$disconnect();
  }

  primaryAccountId = await createAccount(tokenA, {
    name: "Primary",
    type: "CHECKING",
    balance: "100.00",
  });
  savingsAccountId = await createAccount(tokenA, {
    name: "Savings",
    type: "SAVINGS",
    balance: "0.00",
  });
  smallAccountId = await createAccount(tokenA, {
    name: "Small",
    type: "CHECKING",
    balance: "10.00",
  });
  concurrentAccountId = await createAccount(tokenA, {
    name: "Concurrent",
    type: "CHECKING",
    balance: "100.00",
  });
  filterAccountId = await createAccount(tokenA, {
    name: "Filters",
    type: "CHECKING",
    balance: "1000.00",
  });
  accountBId = await createAccount(tokenB, {
    name: "Other",
    type: "CHECKING",
    balance: "50.00",
  });
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

describe("transactions auth guard", () => {
  it("returns 401 for every endpoint without a token", async () => {
    const calls = [
      request("GET", "/api/transactions"),
      request("POST", "/api/transactions", undefined, {
        accountId: primaryAccountId,
        amount: "1.00",
        type: "INCOME",
      }),
      request("GET", "/api/transactions/does-not-exist"),
      request("PATCH", "/api/transactions/does-not-exist", undefined, {
        amount: "1.00",
      }),
      request("DELETE", "/api/transactions/does-not-exist"),
    ];
    for (const result of await Promise.all(calls)) {
      equal(result.status, 401);
    }
  });
});

describe("POST /api/transactions validation", () => {
  it("rejects invalid bodies with 400", async () => {
    const invalidBodies: Array<Record<string, unknown>> = [
      { amount: "10.00", type: "EXPENSE" },
      { accountId: primaryAccountId, type: "EXPENSE" },
      { accountId: primaryAccountId, amount: "10.00" },
      { accountId: primaryAccountId, amount: "0", type: "EXPENSE" },
      { accountId: primaryAccountId, amount: "-1", type: "EXPENSE" },
      { accountId: primaryAccountId, amount: "10.001", type: "EXPENSE" },
      { accountId: primaryAccountId, amount: "10.00", type: "TRANSFER" },
      {
        accountId: primaryAccountId,
        amount: "10.00",
        type: "EXPENSE",
        transactionDate: "not-a-date",
      },
      {
        accountId: primaryAccountId,
        amount: "10.00",
        type: "EXPENSE",
        userId: "someone-else",
      },
    ];

    for (const body of invalidBodies) {
      const result = await request("POST", "/api/transactions", tokenA, body);
      equal(
        result.status,
        400,
        `expected 400 for ${JSON.stringify(body)}`,
      );
    }
  });

  it("rejects category mismatch, unknown categories and foreign accounts", async () => {
    const mismatch = await request("POST", "/api/transactions", tokenA, {
      accountId: primaryAccountId,
      categoryId: incomeCategoryId,
      amount: "10.00",
      type: "EXPENSE",
    });
    equal(mismatch.status, 400);

    const unknownCategory = await request("POST", "/api/transactions", tokenA, {
      accountId: primaryAccountId,
      categoryId: "does-not-exist",
      amount: "10.00",
      type: "EXPENSE",
    });
    equal(unknownCategory.status, 400);

    const foreignAccount = await request("POST", "/api/transactions", tokenA, {
      accountId: accountBId,
      amount: "10.00",
      type: "INCOME",
    });
    equal(foreignAccount.status, 404);

    equal(await balanceOf(tokenA, primaryAccountId), "100.00");
    equal(await balanceOf(tokenB, accountBId), "50.00");
  });

  it("rejects insufficient expenses without changing the account", async () => {
    const result = await request("POST", "/api/transactions", tokenA, {
      accountId: smallAccountId,
      amount: "20.00",
      type: "EXPENSE",
    });
    equal(result.status, 409);
    equal(result.body.error, "Insufficient funds");
    equal(await balanceOf(tokenA, smallAccountId), "10.00");

    const list = await request(
      "GET",
      transactionQuery({ accountId: smallAccountId }),
      tokenA,
    );
    equal(list.status, 200);
    equal(list.body.pagination.total, 0);
  });

  it("allows expenses on credit cards (negative balance is supported)", async () => {
    const cardId = await createAccount(tokenA, {
      name: "Card",
      type: "CREDIT_CARD",
      balance: "0.00",
    });
    const result = await request("POST", "/api/transactions", tokenA, {
      accountId: cardId,
      amount: "50.00",
      type: "EXPENSE",
    });
    equal(result.status, 201);
    equal(result.body.transaction.amount, "50.00");
    equal(await balanceOf(tokenA, cardId), "-50.00");
  });
});

describe("transaction CRUD and balance consistency", () => {
  let transactionId = "";

  it("creates an income transaction and increases the balance", async () => {
    const result = await request("POST", "/api/transactions", tokenA, {
      accountId: primaryAccountId,
      categoryId: incomeCategoryId,
      amount: "500.00",
      type: "INCOME",
      description: "Bonus",
      transactionDate: "2024-01-15T12:00:00.000Z",
    });
    equal(result.status, 201, JSON.stringify(result.body));
    transactionId = result.body.transaction.id as string;
    equal(result.body.transaction.amount, "500.00");
    equal(result.body.transaction.type, "INCOME");
    equal(result.body.transaction.description, "Bonus");
    equal(await balanceOf(tokenA, primaryAccountId), "600.00");
  });

  it("fetches and lists the owned transaction with filters", async () => {
    const one = await request(
      "GET",
      `/api/transactions/${transactionId}`,
      tokenA,
    );
    equal(one.status, 200);
    equal(one.body.transaction.id, transactionId);

    const list = await request(
      "GET",
      transactionQuery({
        accountId: primaryAccountId,
        categoryId: incomeCategoryId,
        type: "INCOME",
        from: "2024-01-15T00:00:00.000Z",
        to: "2024-01-16T00:00:00.000Z",
      }),
      tokenA,
    );
    equal(list.status, 200);
    ok(
      list.body.transactions.some(
        (transaction: { id: string }) => transaction.id === transactionId,
      ),
    );
    ok(list.body.pagination.total >= 1);
  });

  it("returns 404 for another user's transaction without changing balances", async () => {
    const get = await request(
      "GET",
      `/api/transactions/${transactionId}`,
      tokenB,
    );
    equal(get.status, 404);

    const patch = await request(
      "PATCH",
      `/api/transactions/${transactionId}`,
      tokenB,
      { description: "Hijacked" },
    );
    equal(patch.status, 404);

    const del = await request(
      "DELETE",
      `/api/transactions/${transactionId}`,
      tokenB,
    );
    equal(del.status, 404);

    const stillThere = await request(
      "GET",
      `/api/transactions/${transactionId}`,
      tokenA,
    );
    equal(stillThere.status, 200);
    equal(stillThere.body.transaction.description, "Bonus");
    equal(await balanceOf(tokenA, primaryAccountId), "600.00");
  });

  it("reverses the old amount before applying an update", async () => {
    const result = await request(
      "PATCH",
      `/api/transactions/${transactionId}`,
      tokenA,
      { amount: "300.00" },
    );
    equal(result.status, 200);
    equal(result.body.transaction.amount, "300.00");
    equal(await balanceOf(tokenA, primaryAccountId), "400.00");
  });

  it("moves a transaction between owned accounts and reverses both sides", async () => {
    const result = await request(
      "PATCH",
      `/api/transactions/${transactionId}`,
      tokenA,
      { accountId: savingsAccountId },
    );
    equal(result.status, 200);
    equal(result.body.transaction.accountId, savingsAccountId);
    equal(await balanceOf(tokenA, primaryAccountId), "100.00");
    equal(await balanceOf(tokenA, savingsAccountId), "300.00");
  });

  it("enforces category compatibility when the type changes", async () => {
    const mismatch = await request(
      "PATCH",
      `/api/transactions/${transactionId}`,
      tokenA,
      { type: "EXPENSE" },
    );
    equal(mismatch.status, 400);

    const fresh = await request("POST", "/api/transactions", tokenA, {
      accountId: savingsAccountId,
      categoryId: incomeCategoryId,
      amount: "500.00",
      type: "INCOME",
    });
    equal(fresh.status, 201);
    equal(await balanceOf(tokenA, savingsAccountId), "800.00");

    const changed = await request(
      "PATCH",
      `/api/transactions/${transactionId}`,
      tokenA,
      {
        type: "EXPENSE",
        categoryId: expenseCategoryId,
        amount: "50.00",
      },
    );
    equal(changed.status, 200);
    equal(changed.body.transaction.type, "EXPENSE");
    equal(changed.body.transaction.categoryId, expenseCategoryId);
    equal(await balanceOf(tokenA, savingsAccountId), "450.00");
  });

  it("rejects an update that would overdraw and preserves the old state", async () => {
    const overspend = await request(
      "PATCH",
      `/api/transactions/${transactionId}`,
      tokenA,
      { amount: "1000.00" },
    );
    equal(overspend.status, 409);
    equal(overspend.body.error, "Insufficient funds");
    equal(await balanceOf(tokenA, savingsAccountId), "450.00");

    const movedToSmall = await request(
      "PATCH",
      `/api/transactions/${transactionId}`,
      tokenA,
      { accountId: smallAccountId },
    );
    equal(movedToSmall.status, 409);
    equal(await balanceOf(tokenA, savingsAccountId), "450.00");
    equal(await balanceOf(tokenA, smallAccountId), "10.00");

    const unchanged = await request(
      "GET",
      `/api/transactions/${transactionId}`,
      tokenA,
    );
    equal(unchanged.status, 200);
    equal(unchanged.body.transaction.amount, "50.00");
    equal(unchanged.body.transaction.accountId, savingsAccountId);
  });

  it("allows description-only updates and rejects empty or smuggled updates", async () => {
    const renamed = await request(
      "PATCH",
      `/api/transactions/${transactionId}`,
      tokenA,
      { description: "Weekly shop" },
    );
    equal(renamed.status, 200);
    equal(renamed.body.transaction.description, "Weekly shop");
    equal(await balanceOf(tokenA, savingsAccountId), "450.00");

    for (const body of [
      {},
      { userId: "someone-else" },
      { id: "fixed-id" },
    ]) {
      const bad = await request(
        "PATCH",
        `/api/transactions/${transactionId}`,
        tokenA,
        body,
      );
      equal(bad.status, 400);
    }

    const foreignAccount = await request(
      "PATCH",
      `/api/transactions/${transactionId}`,
      tokenA,
      { accountId: accountBId },
    );
    equal(foreignAccount.status, 404);
    equal(await balanceOf(tokenB, accountBId), "50.00");
  });

  it("deletes a transaction and reverses its effect exactly once", async () => {
    const result = await request(
      "DELETE",
      `/api/transactions/${transactionId}`,
      tokenA,
    );
    equal(result.status, 204);
    equal(await balanceOf(tokenA, savingsAccountId), "500.00");

    const gone = await request(
      "GET",
      `/api/transactions/${transactionId}`,
      tokenA,
    );
    equal(gone.status, 404);

    const deletedAgain = await request(
      "DELETE",
      `/api/transactions/${transactionId}`,
      tokenA,
    );
    equal(deletedAgain.status, 404);
    equal(await balanceOf(tokenA, savingsAccountId), "500.00");
  });
});

describe("GET /api/transactions pagination and filters", () => {
  let firstId = "";
  let secondId = "";
  let thirdId = "";
  let fourthId = "";

  before(async () => {
    const seeds = [
      {
        categoryId: incomeCategoryId,
        amount: "100.00",
        type: "INCOME",
        transactionDate: "2024-01-01T12:00:00.000Z",
      },
      {
        categoryId: expenseCategoryId,
        amount: "20.00",
        type: "EXPENSE",
        transactionDate: "2024-02-01T12:00:00.000Z",
      },
      {
        categoryId: incomeCategoryId,
        amount: "50.00",
        type: "INCOME",
        transactionDate: "2024-03-01T12:00:00.000Z",
      },
      {
        categoryId: incomeCategoryId,
        amount: "10.00",
        type: "INCOME",
        transactionDate: "2024-03-02T12:00:00.000Z",
      },
    ];
    const ids: string[] = [];
    for (const seed of seeds) {
      const result = await request("POST", "/api/transactions", tokenA, {
        accountId: filterAccountId,
        ...seed,
      });
      equal(result.status, 201);
      ids.push(result.body.transaction.id as string);
    }
    [firstId, secondId, thirdId, fourthId] = ids;
  });

  it("returns newest first with page metadata", async () => {
    const pageOne = await request(
      "GET",
      transactionQuery({ accountId: filterAccountId, page: 1, limit: 2 }),
      tokenA,
    );
    equal(pageOne.status, 200);
    deepStrictEqual(
      pageOne.body.transactions.map((t: { id: string }) => t.id),
      [fourthId, thirdId],
    );
    deepStrictEqual(pageOne.body.pagination, {
      page: 1,
      limit: 2,
      total: 4,
      totalPages: 2,
      hasNext: true,
      hasPrevious: false,
    });

    const pageTwo = await request(
      "GET",
      transactionQuery({ accountId: filterAccountId, page: 2, limit: 2 }),
      tokenA,
    );
    equal(pageTwo.status, 200);
    deepStrictEqual(
      pageTwo.body.transactions.map((t: { id: string }) => t.id),
      [secondId, firstId],
    );
    equal(pageTwo.body.pagination.hasNext, false);
    equal(pageTwo.body.pagination.hasPrevious, true);
  });

  it("filters by type, category and date range", async () => {
    const byType = await request(
      "GET",
      transactionQuery({ accountId: filterAccountId, type: "INCOME" }),
      tokenA,
    );
    equal(byType.status, 200);
    equal(byType.body.pagination.total, 3);
    ok(
      byType.body.transactions.every(
        (transaction: { type: string }) => transaction.type === "INCOME",
      ),
    );

    const byCategory = await request(
      "GET",
      transactionQuery({
        accountId: filterAccountId,
        categoryId: expenseCategoryId,
      }),
      tokenA,
    );
    equal(byCategory.status, 200);
    deepStrictEqual(
      byCategory.body.transactions.map((t: { id: string }) => t.id),
      [secondId],
    );

    const byDate = await request(
      "GET",
      transactionQuery({
        accountId: filterAccountId,
        from: "2024-02-01T00:00:00.000Z",
        to: "2024-03-01T23:59:59.999Z",
      }),
      tokenA,
    );
    equal(byDate.status, 200);
    deepStrictEqual(
      byDate.body.transactions.map((t: { id: string }) => t.id),
      [thirdId, secondId],
    );

    equal(await balanceOf(tokenA, filterAccountId), "1140.00");
  });

  it("rejects invalid filters and foreign account filters", async () => {
    for (const query of [
      transactionQuery({ page: 0 }),
      transactionQuery({ limit: 101 }),
      transactionQuery({ from: "not-a-date" }),
      transactionQuery({
        from: "2024-03-01T00:00:00.000Z",
        to: "2024-02-01T00:00:00.000Z",
      }),
    ]) {
      const bad = await request("GET", query, tokenA);
      equal(bad.status, 400);
    }

    const foreign = await request(
      "GET",
      transactionQuery({ accountId: accountBId }),
      tokenA,
    );
    equal(foreign.status, 404);
  });
});

describe("concurrent balance updates", () => {
  it("serializes concurrent expenses and prevents overdraft", async () => {
    const payload = {
      accountId: concurrentAccountId,
      amount: "60.00",
      type: "EXPENSE",
    };
    const results = await Promise.all([
      request("POST", "/api/transactions", tokenA, payload),
      request("POST", "/api/transactions", tokenA, payload),
    ]);
    const statuses = results.map((result) => result.status).sort((a, b) => a - b);
    deepStrictEqual(statuses, [201, 409]);
    equal(await balanceOf(tokenA, concurrentAccountId), "40.00");

    const list = await request(
      "GET",
      transactionQuery({ accountId: concurrentAccountId }),
      tokenA,
    );
    equal(list.status, 200);
    equal(list.body.pagination.total, 1);
  });
});
