// Isolated integration test for Step 12 savings pot CRUD, deposits, withdrawals,
// ownership, validation, and dashboard summary. Starts the real server on port
// 4106 with two unique users and deterministic pots inserted through Prisma.
// Cleanup deletes exactly those users (cascading to their pots).
import { deepStrictEqual, equal, ok } from "node:assert";
import { spawn, spawnSync, type ChildProcess } from "node:child_process";
import path from "node:path";
import { after, before, describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";

dotenv.config();

const serverDir = path.dirname(fileURLToPath(import.meta.url));
const PORT = 4106;
const BASE = `http://127.0.0.1:${PORT}`;
const stamp = Date.now();
const emailA = `step12a+${stamp}@example.com`;
const emailB = `step12b+${stamp}@example.com`;
const password = "pot-test-password-1";

let server: ChildProcess | undefined;
let tokenA = "";
let tokenB = "";
const potIds: Record<string, string> = {};

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
    body: JSON.stringify({ name: "Step Twelve", email, password }),
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
    const emergency = await prisma.pot.create({
      data: {
        userId: userA.userId,
        name: "Emergency fund",
        targetAmount: "1000.00",
        currentAmount: "250.50",
        targetDate: new Date("2026-12-31T00:00:00.000Z"),
        createdAt: new Date("2026-10-01T00:00:00.000Z"),
      },
    });
    const vacation = await prisma.pot.create({
      data: {
        userId: userA.userId,
        name: "Vacation",
        targetAmount: "500.00",
        currentAmount: "500.00",
        createdAt: new Date("2026-10-02T00:00:00.000Z"),
      },
    });
    const laptop = await prisma.pot.create({
      data: {
        userId: userA.userId,
        name: "Laptop",
        targetAmount: "900.00",
        currentAmount: "0.00",
        createdAt: new Date("2026-10-03T00:00:00.000Z"),
      },
    });
    const otherUserPot = await prisma.pot.create({
      data: {
        userId: userB.userId,
        name: "Emergency fund",
        targetAmount: "100.00",
        currentAmount: "0.00",
      },
    });
    potIds.emergency = emergency.id;
    potIds.vacation = vacation.id;
    potIds.laptop = laptop.id;
    potIds.otherUser = otherUserPot.id;
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

describe("savings pot authentication and isolation", () => {
  it("requires a valid authenticated token", async () => {
    equal((await request("GET", "/api/pots")).status, 401);
    equal((await request("GET", "/api/pots", "not-a-valid-token")).status, 401);
    equal(
      (
        await request("POST", "/api/pots", undefined, {
          name: "Trip",
          targetAmount: "100.00",
        })
      ).status,
      401,
    );
    equal(
      (await request("POST", `/api/pots/${potIds.emergency}/deposit`)).status,
      401,
    );
  });

  it("lists only the authenticated user's pots", async () => {
    const result = await request("GET", "/api/pots", tokenA);
    equal(result.status, 200);
    deepStrictEqual(
      result.body.pots.map((entry: any) => entry.name),
      ["Emergency fund", "Vacation", "Laptop"],
    );
    equal(JSON.stringify(result.body).includes("userId"), false);
    equal(JSON.stringify(result.body).includes("theme"), false);
    equal(JSON.stringify(result.body).includes(emailA), false);

    const other = await request("GET", "/api/pots", tokenB);
    equal(other.status, 200);
    equal(other.body.pots.length, 1);
    equal(other.body.pots[0].name, "Emergency fund");
    equal(other.body.pots[0].targetAmount, "100.00");
  });

  it("does not expose or mutate another user's pot", async () => {
    const id = potIds.emergency;
    equal((await request("GET", `/api/pots/${id}`, tokenB)).status, 404);
    equal(
      (
        await request("PATCH", `/api/pots/${id}`, tokenB, {
          name: "Stolen",
        })
      ).status,
      404,
    );
    equal(
      (
        await request("POST", `/api/pots/${id}/deposit`, tokenB, {
          amount: "10.00",
        })
      ).status,
      404,
    );
    equal(
      (
        await request("POST", `/api/pots/${id}/withdraw`, tokenB, {
          amount: "10.00",
        })
      ).status,
      404,
    );
    equal((await request("DELETE", `/api/pots/${id}`, tokenB)).status, 404);

    const read = await request("GET", `/api/pots/${id}`, tokenA);
    equal(read.status, 200);
    equal(read.body.pot.currentAmount, "250.50");
  });
});

describe("savings pot DTOs and dashboard summary", () => {
  it("returns typed pot fields without user or theme data", async () => {
    const result = await request(
      "GET",
      `/api/pots/${potIds.emergency}`,
      tokenA,
    );
    equal(result.status, 200);
    deepStrictEqual(Object.keys(result.body.pot).sort(), [
      "createdAt",
      "currentAmount",
      "id",
      "isComplete",
      "name",
      "percentage",
      "remaining",
      "targetAmount",
      "targetDate",
      "updatedAt",
    ]);
    deepStrictEqual(
      {
        name: result.body.pot.name,
        targetAmount: result.body.pot.targetAmount,
        currentAmount: result.body.pot.currentAmount,
        targetDate: result.body.pot.targetDate,
        remaining: result.body.pot.remaining,
        percentage: result.body.pot.percentage,
        isComplete: result.body.pot.isComplete,
      },
      {
        name: "Emergency fund",
        targetAmount: "1000.00",
        currentAmount: "250.50",
        targetDate: "2026-12-31",
        remaining: "749.50",
        percentage: 25.05,
        isComplete: false,
      },
    );
  });

  it("summarizes all owned pots on the dashboard", async () => {
    const result = await request("GET", "/api/dashboard/summary", tokenA);
    equal(result.status, 200);
    deepStrictEqual(result.body.potSummary, {
      count: 3,
      totalSaved: "750.50",
      totalTarget: "2400.00",
      totalRemaining: "1649.50",
      completedCount: 1,
      percentage: 31.27,
    });
  });

  it("isolates the dashboard pot summary by user", async () => {
    const result = await request("GET", "/api/dashboard/summary", tokenB);
    equal(result.status, 200);
    deepStrictEqual(result.body.potSummary, {
      count: 1,
      totalSaved: "0.00",
      totalTarget: "100.00",
      totalRemaining: "100.00",
      completedCount: 0,
      percentage: 0,
    });
  });
});

describe("savings pot validation and conflicts", () => {
  it("rejects invalid targets, saved amounts, dates, and unknown fields", async () => {
    const base = { name: "Trip", targetAmount: "100.00" };
    const invalidPayloads = [
      { ...base, targetAmount: "0" },
      { ...base, targetAmount: "-1" },
      { ...base, targetAmount: "1.234" },
      { ...base, currentAmount: "-0.01" },
      { ...base, targetDate: "2026-02-29" },
      { ...base, targetDate: "2026-12-31T00:00:00Z" },
      { ...base, userId: "attacker" },
      { name: "Trip" },
    ];
    for (const payload of invalidPayloads) {
      const result = await request("POST", "/api/pots", tokenA, payload);
      equal(result.status, 400, JSON.stringify(payload));
    }

    equal(
      (
        await request("POST", "/api/pots", tokenA, {
          ...base,
          currentAmount: "100.01",
        })
      ).status,
      400,
    );
    equal(
      (await request("PATCH", `/api/pots/${potIds.laptop}`, tokenA, {})).status,
      400,
    );
    equal(
      (
        await request("PATCH", `/api/pots/${potIds.emergency}`, tokenA, {
          targetAmount: "200.00",
        })
      ).status,
      400,
    );
  });

  it("returns 409 for a duplicate pot name per user", async () => {
    const duplicateA = await request("POST", "/api/pots", tokenA, {
      name: "Emergency fund",
      targetAmount: "500.00",
    });
    equal(duplicateA.status, 409);

    const duplicateB = await request("POST", "/api/pots", tokenB, {
      name: "Emergency fund",
      targetAmount: "500.00",
    });
    equal(duplicateB.status, 409);
  });

  it("rejects zero, negative, oversized deposits and withdrawals", async () => {
    const invalidMovements = [
      { amount: "0" },
      { amount: "-1" },
      { amount: "1.234" },
      { amount: "abc" },
      { amount: "749.51" },
    ];
    for (const payload of invalidMovements) {
      const result = await request(
        "POST",
        `/api/pots/${potIds.emergency}/deposit`,
        tokenA,
        payload,
      );
      equal(result.status, 400, JSON.stringify(payload));
    }

    equal(
      (
        await request(
          "POST",
          `/api/pots/${potIds.emergency}/withdraw`,
          tokenA,
          { amount: "250.51" },
        )
      ).status,
      400,
    );
    equal(
      (
        await request("POST", `/api/pots/${potIds.laptop}/withdraw`, tokenA, {
          amount: "0.01",
        })
      ).status,
      400,
    );
    equal(
      (
        await request(
          "POST",
          `/api/pots/${potIds.emergency}/deposit`,
          tokenA,
          { amount: "10.00", userId: "attacker" },
        )
      ).status,
      400,
    );
  });
});

describe("savings pot create, update, movements, and delete", () => {
  it("supports a full CRUD and funding flow", async () => {
    let cameraId = "";
    try {
      const created = await request("POST", "/api/pots", tokenA, {
        name: "Camera",
        targetAmount: "800.00",
        currentAmount: "100.00",
        targetDate: "2027-06-15",
      });
      equal(created.status, 201);
      equal(created.body.pot.name, "Camera");
      equal(created.body.pot.targetAmount, "800.00");
      equal(created.body.pot.currentAmount, "100.00");
      equal(created.body.pot.targetDate, "2027-06-15");
      equal(created.body.pot.remaining, "700.00");
      equal(created.body.pot.percentage, 12.5);
      equal(created.body.pot.isComplete, false);
      cameraId = created.body.pot.id;
      ok(cameraId);

      const updated = await request(
        "PATCH",
        `/api/pots/${cameraId}`,
        tokenA,
        {
          name: "Camera gear",
          targetAmount: "1000.00",
          targetDate: null,
        },
      );
      equal(updated.status, 200);
      equal(updated.body.pot.name, "Camera gear");
      equal(updated.body.pot.targetAmount, "1000.00");
      equal(updated.body.pot.targetDate, null);
      equal(updated.body.pot.currentAmount, "100.00");

      const deposit = await request(
        "POST",
        `/api/pots/${cameraId}/deposit`,
        tokenA,
        { amount: "100.00" },
      );
      equal(deposit.status, 200);
      equal(deposit.body.pot.currentAmount, "200.00");
      equal(deposit.body.pot.remaining, "800.00");
      equal(deposit.body.pot.percentage, 20);

      const withdraw = await request(
        "POST",
        `/api/pots/${cameraId}/withdraw`,
        tokenA,
        { amount: "50.00" },
      );
      equal(withdraw.status, 200);
      equal(withdraw.body.pot.currentAmount, "150.00");
      equal(withdraw.body.pot.remaining, "850.00");

      const complete = await request(
        "POST",
        `/api/pots/${cameraId}/deposit`,
        tokenA,
        { amount: "850.00" },
      );
      equal(complete.status, 200);
      equal(complete.body.pot.currentAmount, "1000.00");
      equal(complete.body.pot.remaining, "0.00");
      equal(complete.body.pot.percentage, 100);
      equal(complete.body.pot.isComplete, true);

      equal(
        (
          await request(
            "POST",
            `/api/pots/${cameraId}/deposit`,
            tokenA,
            { amount: "0.01" },
          )
        ).status,
        400,
      );

      const removed = await request(
        "DELETE",
        `/api/pots/${cameraId}`,
        tokenA,
      );
      equal(removed.status, 204);
      equal(
        (await request("GET", `/api/pots/${cameraId}`, tokenA)).status,
        404,
      );
      equal(
        (await request("DELETE", `/api/pots/${cameraId}`, tokenA)).status,
        404,
      );
      cameraId = "";
    } finally {
      if (cameraId) {
        const { PrismaClient } = await import("@prisma/client");
        const prisma = new PrismaClient();
        try {
          await prisma.pot.deleteMany({ where: { id: cameraId } });
        } finally {
          await prisma.$disconnect();
        }
      }
    }
  });
});
