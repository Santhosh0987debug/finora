// Isolated integration test for Step 5 accounts endpoints.
// Strategy: starts the real server on an isolated port (4102), creates TWO
// uniquely-named test users plus only the accounts/transactions this run
// needs, then deletes exactly those rows in `finally` (transactions first,
// then accounts, then users). Seed categories and all other rows are
// untouched. Run with: npm run test:integration --workspace=server
import { deepStrictEqual, equal, ok } from "node:assert";
import { spawn, spawnSync, type ChildProcess } from "node:child_process";
import path from "node:path";
import { after, before, describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";

dotenv.config();

const serverDir = path.dirname(fileURLToPath(import.meta.url));
const PORT = 4102;
const BASE = `http://127.0.0.1:${PORT}`;
const stamp = Date.now();
const emailA = `step5a+${stamp}@example.com`;
const emailB = `step5b+${stamp}@example.com`;
const password = "accounts-test-password-1";
const txnMarker = `step5-test-txn-${stamp}`;

let server: ChildProcess | undefined;
let tokenA = "";
let tokenB = "";
let accountAId = "";
let accountBId = "";
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

async function register(email: string): Promise<string> {
  const res = await fetch(`${BASE}/api/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: "Step Five", email, password }),
  });
  equal(res.status, 201);
  const body = await res.json();
  return body.token as string;
}

function auth(token: string) {
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
  };
}

// Stops the spawned test server including its child processes (with
// shell:true, kill() alone would orphan the grandchild server process).
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
    categoriesBefore = await prisma.category.count();
  } finally {
    await prisma.$disconnect();
  }
});

after(async () => {
  stopServer(server);
  // Cleanup: only rows created by this run.
  const { PrismaClient } = await import("@prisma/client");
  const prisma = new PrismaClient();
  try {
    const users = await prisma.user.findMany({
      where: { email: { in: [emailA, emailB] } },
      select: { id: true },
    });
    const userIds = users.map((u) => u.id);
    if (userIds.length > 0) {
      await prisma.transaction.deleteMany({
        where: { userId: { in: userIds } },
      });
      await prisma.account.deleteMany({ where: { userId: { in: userIds } } });
      await prisma.user.deleteMany({ where: { id: { in: userIds } } });
    }
    equal(await prisma.category.count(), categoriesBefore);
  } finally {
    await prisma.$disconnect();
  }
});

describe("accounts auth guard", () => {
  it("returns 401 without a token", async () => {
    for (const init of [
      fetch(`${BASE}/api/accounts`),
      fetch(`${BASE}/api/accounts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "X", type: "CHECKING" }),
      }),
    ]) {
      equal((await init).status, 401);
    }
  });
});

describe("POST /api/accounts", () => {
  it("creates with defaults and with explicit money fields", async () => {
    const minimal = await fetch(`${BASE}/api/accounts`, {
      method: "POST",
      headers: auth(tokenA),
      body: JSON.stringify({ name: "Everyday", type: "CHECKING" }),
    });
    equal(minimal.status, 201);
    const minBody = await minimal.json();
    equal(minBody.account.balance, "0.00");
    equal(minBody.account.currency, "USD");
    equal(minBody.account.userId !== undefined, true);
    accountAId = minBody.account.id as string;

    const full = await fetch(`${BASE}/api/accounts`, {
      method: "POST",
      headers: auth(tokenB),
      body: JSON.stringify({
        name: "Vault",
        type: "SAVINGS",
        balance: "1250.50",
        currency: "eur",
      }),
    });
    equal(full.status, 201);
    const fullBody = await full.json();
    deepStrictEqual(
      [fullBody.account.balance, fullBody.account.currency],
      ["1250.50", "EUR"],
    );
    accountBId = fullBody.account.id as string;
  });

  it("rejects invalid input with 400", async () => {
    for (const body of [
      { name: "X", type: "CHEQUING" },
      { name: "X", type: "CHECKING", balance: "10.001" },
      { name: "X", type: "CHECKING", balance: 0.30000000000000004 },
      { name: "X", type: "CHECKING", currency: "US" },
      { name: "", type: "CHECKING" },
      { name: "X", type: "CHECKING", userId: "someone-else" },
      { name: "X", type: "CREDIT_CARD" },
    ]) {
      // Last entry is valid — verified separately below.
      if ((body as { type: string }).type === "CREDIT_CARD") continue;
      const res = await fetch(`${BASE}/api/accounts`, {
        method: "POST",
        headers: auth(tokenA),
        body: JSON.stringify(body),
      });
      equal(res.status, 400, `expected 400: ${JSON.stringify(body)}`);
    }
    const credit = await fetch(`${BASE}/api/accounts`, {
      method: "POST",
      headers: auth(tokenA),
      body: JSON.stringify({ name: "Card", type: "CREDIT_CARD", balance: -120.5 }),
    });
    equal(credit.status, 201);
  });
});

describe("GET /api/accounts", () => {
  it("lists only the caller's accounts in stable order", async () => {
    const resA = await fetch(`${BASE}/api/accounts`, {
      headers: auth(tokenA),
    });
    equal(resA.status, 200);
    const bodyA = await resA.json();
    ok(Array.isArray(bodyA.accounts));
    ok(bodyA.accounts.length >= 2);
    ok(bodyA.accounts.every((a: { userId: string }) => a.userId !== undefined));
    // Stable ordering: createdAt desc, id asc tie-break.
    const times = bodyA.accounts.map((a: { createdAt: string }) =>
      Date.parse(a.createdAt),
    );
    for (let i = 1; i < times.length; i += 1) {
      ok(times[i - 1] >= times[i]);
    }

    const resB = await fetch(`${BASE}/api/accounts`, {
      headers: auth(tokenB),
    });
    const bodyB = await resB.json();
    equal(bodyB.accounts.length, 1);
    equal(bodyB.accounts[0].id, accountBId);
    ok(!bodyA.accounts.some((a: { id: string }) => a.id === accountBId));
  });
});

describe("ownership isolation", () => {
  it("returns 404 for another user's account on read/update/delete", async () => {
    const get = await fetch(`${BASE}/api/accounts/${accountAId}`, {
      headers: auth(tokenB),
    });
    equal(get.status, 404);

    const patch = await fetch(`${BASE}/api/accounts/${accountAId}`, {
      method: "PATCH",
      headers: auth(tokenB),
      body: JSON.stringify({ name: "Hijacked" }),
    });
    equal(patch.status, 404);

    const del = await fetch(`${BASE}/api/accounts/${accountAId}`, {
      method: "DELETE",
      headers: auth(tokenB),
    });
    equal(del.status, 404);

    // Victim's account is untouched.
    const check = await fetch(`${BASE}/api/accounts/${accountAId}`, {
      headers: auth(tokenA),
    });
    equal(check.status, 200);
    equal((await check.json()).account.name, "Everyday");
  });
});

describe("PATCH /api/accounts/:id", () => {
  it("updates permitted fields and rejects the rest", async () => {
    const res = await fetch(`${BASE}/api/accounts/${accountAId}`, {
      method: "PATCH",
      headers: auth(tokenA),
      body: JSON.stringify({ name: "Everyday Plus", balance: "250.75" }),
    });
    equal(res.status, 200);
    const body = await res.json();
    deepStrictEqual(
      [body.account.name, body.account.balance, body.account.type],
      ["Everyday Plus", "250.75", "CHECKING"],
    );

    for (const bodyText of [
      JSON.stringify({}),
      JSON.stringify({ userId: "someone-else" }),
      JSON.stringify({ id: "other-id" }),
      JSON.stringify({ balance: "1.234" }),
    ]) {
      const bad = await fetch(`${BASE}/api/accounts/${accountAId}`, {
        method: "PATCH",
        headers: auth(tokenA),
        body: bodyText,
      });
      equal(bad.status, 400);
    }

    const missing = await fetch(`${BASE}/api/accounts/does-not-exist`, {
      method: "PATCH",
      headers: auth(tokenA),
      body: JSON.stringify({ name: "Nope" }),
    });
    equal(missing.status, 404);
  });
});

describe("DELETE /api/accounts/:id", () => {
  it("refuses deletion while transactions reference the account", async () => {
    const { PrismaClient } = await import("@prisma/client");
    const prisma = new PrismaClient();
    try {
      const me = await fetch(`${BASE}/api/auth/me`, {
        headers: auth(tokenA),
      }).then((r) => r.json());
      await prisma.transaction.create({
        data: {
          userId: me.user.id as string,
          accountId: accountAId,
          amount: "10.00",
          type: "EXPENSE",
          description: txnMarker,
        },
      });
    } finally {
      await prisma.$disconnect();
    }

    const blocked = await fetch(`${BASE}/api/accounts/${accountAId}`, {
      method: "DELETE",
      headers: auth(tokenA),
    });
    equal(blocked.status, 409);

    // Account and its history survive the refused deletion.
    const stillThere = await fetch(`${BASE}/api/accounts/${accountAId}`, {
      headers: auth(tokenA),
    });
    equal(stillThere.status, 200);

    // Remove the test transaction, then deletion succeeds.
    const prisma2 = new PrismaClient();
    try {
      await prisma2.transaction.deleteMany({
        where: { description: txnMarker },
      });
    } finally {
      await prisma2.$disconnect();
    }
    const deleted = await fetch(`${BASE}/api/accounts/${accountAId}`, {
      method: "DELETE",
      headers: auth(tokenA),
    });
    equal(deleted.status, 204);
    const gone = await fetch(`${BASE}/api/accounts/${accountAId}`, {
      headers: auth(tokenA),
    });
    equal(gone.status, 404);
  });
});
