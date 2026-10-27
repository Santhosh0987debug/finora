// Isolated integration test for Step 4 auth endpoints.
// Strategy: starts the real server on an isolated port (4101), registers ONE
// uniquely-named test user, exercises register/duplicate/login/me, then
// deletes that single test user in `finally`. No seed data, migrations, or
// other rows are touched. Run with: npm run test:integration --workspace=server
import { equal, ok } from "node:assert";
import { spawn, spawnSync, type ChildProcess } from "node:child_process";
import path from "node:path";
import { after, before, describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";

dotenv.config();

const serverDir = path.dirname(fileURLToPath(import.meta.url));
const PORT = 4101;
const BASE = `http://127.0.0.1:${PORT}`;
const email = `step4test+${Date.now()}@example.com`;
const password = "integration-test-password-1";
let server: ChildProcess | undefined;
let token = "";

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

function hasPasswordHash(value: unknown): boolean {
  return JSON.stringify(value).includes("passwordHash");
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
});

after(async () => {
  stopServer(server);
  // Cleanup: remove only the single test user created by this run.
  const { PrismaClient } = await import("@prisma/client");
  const prisma = new PrismaClient();
  try {
    await prisma.user.deleteMany({ where: { email } });
  } finally {
    await prisma.$disconnect();
  }
});

describe("POST /api/auth/register", () => {
  it("registers a user without exposing passwordHash", async () => {
    const res = await fetch(`${BASE}/api/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Step Four", email, password }),
    });
    equal(res.status, 201);
    const body = await res.json();
    equal(body.user.email, email.toLowerCase());
    ok(body.token);
    equal(hasPasswordHash(body), false);
  });

  it("rejects invalid input with 400", async () => {
    const res = await fetch(`${BASE}/api/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "", email: "bad", password: "short" }),
    });
    equal(res.status, 400);
  });

  it("rejects a duplicate email with 409", async () => {
    const res = await fetch(`${BASE}/api/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "Step Four",
        email: email.toUpperCase(),
        password,
      }),
    });
    equal(res.status, 409);
  });
});

describe("POST /api/auth/login", () => {
  it("rejects wrong credentials with generic 401", async () => {
    for (const body of [
      { email, password: "wrong-password-1" },
      { email: "nobody+nosuchuser@example.com", password },
    ]) {
      const res = await fetch(`${BASE}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      equal(res.status, 401);
      const payload = await res.json();
      equal(payload.error, "Invalid email or password");
      equal(hasPasswordHash(payload), false);
    }
  });

  it("logs in with valid credentials without exposing passwordHash", async () => {
    const res = await fetch(`${BASE}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    equal(res.status, 200);
    const body = await res.json();
    ok(body.token);
    equal(body.user.email, email.toLowerCase());
    equal(hasPasswordHash(body), false);
    token = body.token;
  });
});

describe("GET /api/auth/me", () => {
  it("returns the profile for a valid token", async () => {
    const res = await fetch(`${BASE}/api/auth/me`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    equal(res.status, 200);
    const body = await res.json();
    equal(body.user.email, email.toLowerCase());
    equal(hasPasswordHash(body), false);
  });

  it("returns 401 without a token or with a bad token", async () => {
    const clean = await fetch(`${BASE}/api/auth/me`);
    equal(clean.status, 401);
    const bad = await fetch(`${BASE}/api/auth/me`, {
      headers: { Authorization: "Bearer invalid" },
    });
    equal(bad.status, 401);
  });
});
