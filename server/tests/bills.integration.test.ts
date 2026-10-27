// Isolated integration test for Step 13 recurring bill CRUD, paid/unpaid status,
// ownership, validation, effective overdue state, and dashboard summary. Starts
// the real server on port 4107 with two unique users and deterministic bills.
// Cleanup deletes exactly those users (cascading to their bills).
import { deepStrictEqual, equal, ok } from "node:assert";
import { spawn, spawnSync, type ChildProcess } from "node:child_process";
import path from "node:path";
import { after, before, describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";

dotenv.config();

const serverDir = path.dirname(fileURLToPath(import.meta.url));
const PORT = 4107;
const BASE = `http://127.0.0.1:${PORT}`;
const stamp = Date.now();
const emailA = `step13a+${stamp}@example.com`;
const emailB = `step13b+${stamp}@example.com`;
const password = "bill-test-password-1";

let server: ChildProcess | undefined;
let tokenA = "";
let tokenB = "";
let userIdA = "";
let userIdB = "";
let crudBillId = "";
const billIds: Record<string, string> = {};

function dateOnly(offsetDays: number): string {
  const today = new Date();
  const value = new Date(
    Date.UTC(
      today.getUTCFullYear(),
      today.getUTCMonth(),
      today.getUTCDate(),
    ),
  );
  value.setUTCDate(value.getUTCDate() + offsetDays);
  return value.toISOString().slice(0, 10);
}

function dueDate(offsetDays: number): Date {
  return new Date(`${dateOnly(offsetDays)}T00:00:00.000Z`);
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
    // Best effort - cleanup still removes the unique users.
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
    body: JSON.stringify({ name: "Step Thirteen", email, password }),
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
  userIdA = userA.userId;
  userIdB = userB.userId;

  const { PrismaClient } = await import("@prisma/client");
  const prisma = new PrismaClient();
  try {
    const overdue = await prisma.recurringBill.create({
      data: {
        userId: userA.userId,
        name: "Rent",
        amount: "1200.00",
        dueDate: dueDate(-3),
        frequency: "MONTHLY",
        status: "UPCOMING",
        createdAt: new Date("2026-10-01T10:00:00.000Z"),
      },
    });
    const upcoming = await prisma.recurringBill.create({
      data: {
        userId: userA.userId,
        name: "Internet",
        amount: "80.00",
        dueDate: dueDate(5),
        frequency: "MONTHLY",
        status: "UPCOMING",
        createdAt: new Date("2026-10-02T10:00:00.000Z"),
      },
    });
    const paidFuture = await prisma.recurringBill.create({
      data: {
        userId: userA.userId,
        name: "Netflix",
        amount: "20.00",
        dueDate: dueDate(2),
        frequency: "MONTHLY",
        status: "PAID",
        createdAt: new Date("2026-10-03T10:00:00.000Z"),
      },
    });
    const paidPast = await prisma.recurringBill.create({
      data: {
        userId: userA.userId,
        name: "Phone",
        amount: "50.00",
        dueDate: dueDate(-10),
        frequency: "MONTHLY",
        status: "PAID",
        createdAt: new Date("2026-10-04T10:00:00.000Z"),
      },
    });
    const otherUserBill = await prisma.recurringBill.create({
      data: {
        userId: userB.userId,
        name: "Rent",
        amount: "900.00",
        dueDate: dueDate(-1),
        frequency: "MONTHLY",
        status: "UPCOMING",
      },
    });

    billIds.overdue = overdue.id;
    billIds.upcoming = upcoming.id;
    billIds.paidFuture = paidFuture.id;
    billIds.paidPast = paidPast.id;
    billIds.otherUser = otherUserBill.id;
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
  } finally {
    await prisma.$disconnect();
  }
});

describe("recurring bill authentication and isolation", () => {
  it("requires a valid authenticated token", async () => {
    equal((await request("GET", "/api/bills")).status, 401);
    equal((await request("GET", "/api/bills", "not-a-valid-token")).status, 401);
    equal(
      (
        await request("POST", "/api/bills", undefined, {
          name: "Rent",
          amount: "100.00",
          frequency: "MONTHLY",
          dueDate: dateOnly(5),
        })
      ).status,
      401,
    );
    equal(
      (
        await request(
          "PATCH",
          `/api/bills/${billIds.overdue}/status`,
          undefined,
          { status: "PAID" },
        )
      ).status,
      401,
    );
  });

  it("lists only the authenticated user's bills with derived statuses", async () => {
    const result = await request("GET", "/api/bills", tokenA);
    equal(result.status, 200);
    deepStrictEqual(
      result.body.bills.map((entry: any) => entry.name),
      ["Rent", "Internet", "Netflix", "Phone"],
    );
    equal(result.body.bills[0].status, "OVERDUE");
    equal(result.body.bills[0].daysUntilDue, -3);
    equal(result.body.bills[1].status, "UPCOMING");
    equal(result.body.bills[1].daysUntilDue, 5);
    equal(result.body.bills[2].status, "PAID");
    equal(result.body.bills[3].status, "PAID");
    equal(result.body.bills[0].dueDate, dateOnly(-3));
    equal(result.body.bills[0].amount, "1200.00");
    equal(JSON.stringify(result.body).includes("userId"), false);
    equal(JSON.stringify(result.body).includes(emailA), false);

    const other = await request("GET", "/api/bills", tokenB);
    equal(other.status, 200);
    equal(other.body.bills.length, 1);
    equal(other.body.bills[0].name, "Rent");
    equal(other.body.bills[0].amount, "900.00");
    equal(other.body.bills[0].status, "OVERDUE");
  });

  it("does not expose or mutate another user's bill", async () => {
    const id = billIds.overdue;
    equal((await request("GET", `/api/bills/${id}`, tokenB)).status, 404);
    equal(
      (
        await request("PATCH", `/api/bills/${id}`, tokenB, {
          name: "Stolen",
        })
      ).status,
      404,
    );
    equal(
      (
        await request("PATCH", `/api/bills/${id}/status`, tokenB, {
          status: "PAID",
        })
      ).status,
      404,
    );
    equal((await request("DELETE", `/api/bills/${id}`, tokenB)).status, 404);
  });

  it("returns 404 for unknown bills", async () => {
    equal(
      (await request("GET", "/api/bills/missing-bill", tokenA)).status,
      404,
    );
    equal(
      (
        await request("PATCH", "/api/bills/missing-bill/status", tokenA, {
          status: "PAID",
        })
      ).status,
      404,
    );
  });
});

describe("recurring bill dashboard summary", () => {
  it("summarizes unpaid totals, overdue totals, and the next bill", async () => {
    const result = await request("GET", "/api/dashboard/summary", tokenA);
    equal(result.status, 200);
    deepStrictEqual(result.body.billSummary, {
      count: 4,
      overdueCount: 1,
      upcomingCount: 1,
      paidCount: 2,
      totalDue: "1280.00",
      overdueAmount: "1200.00",
      nextDue: {
        id: billIds.overdue,
        name: "Rent",
        amount: "1200.00",
        dueDate: dateOnly(-3),
        status: "OVERDUE",
      },
    });

    const other = await request("GET", "/api/dashboard/summary", tokenB);
    equal(other.status, 200);
    equal(other.body.billSummary.count, 1);
    equal(other.body.billSummary.overdueCount, 1);
    equal(other.body.billSummary.totalDue, "900.00");
    equal(other.body.billSummary.nextDue.name, "Rent");
  });
});

describe("recurring bill validation", () => {
  it("rejects invalid payloads, derived statuses, and ownership fields", async () => {
    const valid = {
      name: "Insurance",
      amount: "45.00",
      frequency: "QUARTERLY",
      dueDate: dateOnly(30),
    };

    const cases: unknown[] = [
      { ...valid, name: " " },
      { ...valid, amount: "0" },
      { ...valid, amount: "12.345" },
      { ...valid, frequency: "DAILY" },
      { ...valid, dueDate: "2026-02-30" },
      { ...valid, status: "OVERDUE" },
      { ...valid, userId: userIdA },
      { ...valid, id: "attacker-controlled" },
    ];
    for (const payload of cases) {
      const result = await request("POST", "/api/bills", tokenA, payload);
      equal(result.status, 400, JSON.stringify(payload));
    }

    equal(
      (
        await request("PATCH", `/api/bills/${billIds.overdue}`, tokenA, {})
      ).status,
      400,
    );
    equal(
      (
        await request("PATCH", `/api/bills/${billIds.overdue}`, tokenA, {
          userId: userIdB,
        })
      ).status,
      400,
    );
    equal(
      (
        await request(
          "PATCH",
          `/api/bills/${billIds.overdue}/status`,
          tokenA,
          { status: "OVERDUE" },
        )
      ).status,
      400,
    );
  });
});

describe("recurring bill CRUD and paid state", () => {
  it("creates a bill with a normalized due date", async () => {
    const result = await request("POST", "/api/bills", tokenA, {
      name: "  Gym membership  ",
      amount: "39.99",
      frequency: "WEEKLY",
      dueDate: dateOnly(30),
    });
    equal(result.status, 201);
    equal(result.body.bill.name, "Gym membership");
    equal(result.body.bill.amount, "39.99");
    equal(result.body.bill.frequency, "WEEKLY");
    equal(result.body.bill.dueDate, dateOnly(30));
    equal(result.body.bill.status, "UPCOMING");
    equal(result.body.bill.daysUntilDue, 30);
    equal("userId" in result.body.bill, false);
    crudBillId = result.body.bill.id;
    ok(crudBillId);
  });

  it("gets and updates a bill", async () => {
    const got = await request("GET", `/api/bills/${crudBillId}`, tokenA);
    equal(got.status, 200);
    equal(got.body.bill.name, "Gym membership");

    const result = await request(
      "PATCH",
      `/api/bills/${crudBillId}`,
      tokenA,
      {
        name: "Gym",
        amount: "44.50",
        frequency: "MONTHLY",
        dueDate: dateOnly(-1),
      },
    );
    equal(result.status, 200);
    equal(result.body.bill.name, "Gym");
    equal(result.body.bill.amount, "44.50");
    equal(result.body.bill.frequency, "MONTHLY");
    equal(result.body.bill.dueDate, dateOnly(-1));
    equal(result.body.bill.status, "OVERDUE");
  });

  it("marks a bill paid, then upcoming again", async () => {
    const paid = await request(
      "PATCH",
      `/api/bills/${crudBillId}/status`,
      tokenA,
      { status: "PAID" },
    );
    equal(paid.status, 200);
    equal(paid.body.bill.status, "PAID");

    const upcoming = await request(
      "PATCH",
      `/api/bills/${crudBillId}/status`,
      tokenA,
      { status: "UPCOMING" },
    );
    equal(upcoming.status, 200);
    // The past due date correctly derives OVERDUE again after unpaying.
    equal(upcoming.body.bill.status, "OVERDUE");
  });

  it("deletes a bill and returns not found afterwards", async () => {
    equal(
      (await request("DELETE", `/api/bills/${crudBillId}`, tokenA)).status,
      204,
    );
    equal(
      (await request("GET", `/api/bills/${crudBillId}`, tokenA)).status,
      404,
    );
  });
});
