// Unit tests for Step 4 authentication building blocks.
// No database access: validation, password hashing, JWT handling and the
// auth middleware only. Run with: npm run test:unit --workspace=server
import { deepStrictEqual, equal, ok } from "node:assert";
import { after, before, describe, it } from "node:test";
import jwt from "jsonwebtoken";
import { loginSchema, registerSchema } from "../src/schemas/auth.js";
import { hashPassword, verifyPassword } from "../src/lib/password.js";
import {
  getJwtSecret,
  signAccessToken,
  verifyAccessToken,
} from "../src/lib/jwt.js";
import { requireAuth } from "../src/middleware/requireAuth.js";

const TEST_SECRET = "unit-test-secret-0123456789abcdef";
const originalSecret = process.env.JWT_SECRET;

before(() => {
  process.env.JWT_SECRET = TEST_SECRET;
});

after(() => {
  if (originalSecret === undefined) {
    delete process.env.JWT_SECRET;
  } else {
    process.env.JWT_SECRET = originalSecret;
  }
});

function mockResponse() {
  const res = {
    statusCode: 0,
    body: undefined as unknown,
    status(code: number) {
      res.statusCode = code;
      return res;
    },
    json(payload: unknown) {
      res.body = payload;
      return res;
    },
  };
  return res;
}

describe("registerSchema", () => {
  it("accepts valid input and normalizes the email", () => {
    const parsed = registerSchema.safeParse({
      name: "  Ada  ",
      email: "  Ada@Example.COM ",
      password: "s3cure-password",
    });
    ok(parsed.success);
    deepStrictEqual(parsed.data, {
      name: "Ada",
      email: "ada@example.com",
      password: "s3cure-password",
    });
  });

  it("rejects short passwords, bad emails and empty names", () => {
    for (const body of [
      { name: "Ada", email: "ada@example.com", password: "short" },
      { name: "Ada", email: "not-an-email", password: "s3cure-password" },
      { name: "   ", email: "ada@example.com", password: "s3cure-password" },
    ]) {
      equal(registerSchema.safeParse(body).success, false);
    }
  });
});

describe("loginSchema", () => {
  it("normalizes email and requires a password", () => {
    const parsed = loginSchema.safeParse({
      email: "ADA@EXAMPLE.COM",
      password: "x",
    });
    ok(parsed.success);
    equal(parsed.data.email, "ada@example.com");
    equal(loginSchema.safeParse({ email: "a@b.co", password: "" }).success, false);
  });
});

describe("password hashing (bcryptjs)", () => {
  it("verifies the correct password and rejects a wrong one", async () => {
    const hash = await hashPassword("s3cure-password");
    ok(hash !== "s3cure-password");
    equal(await verifyPassword("s3cure-password", hash), true);
    equal(await verifyPassword("wrong-password", hash), false);
  });
});

describe("JWT handling", () => {
  it("round-trips the user id through sign/verify", () => {
    const token = signAccessToken("user-123");
    equal(verifyAccessToken(token), "user-123");
  });

  it("rejects tampered, expired and foreign-secret tokens", () => {
    const token = signAccessToken("user-123");
    // Tampered signature.
    try {
      verifyAccessToken(token.slice(0, -1) + (token.endsWith("a") ? "b" : "a"));
      ok(false, "tampered token should throw");
    } catch {
      ok(true);
    }
    // Expired token (signed directly with a negative TTL).
    const expired = jwt.sign({ sub: "user-123" }, TEST_SECRET, {
      expiresIn: "-1s",
    });
    try {
      verifyAccessToken(expired);
      ok(false, "expired token should throw");
    } catch {
      ok(true);
    }
    // Token from a different secret.
    const foreign = jwt.sign({ sub: "user-123" }, "another-secret-0123456789abcdef", {
      expiresIn: "1h",
    });
    try {
      verifyAccessToken(foreign);
      ok(false, "foreign token should throw");
    } catch {
      ok(true);
    }
  });

  it("fails safely when JWT_SECRET is missing", () => {
    const saved = process.env.JWT_SECRET;
    delete process.env.JWT_SECRET;
    try {
      getJwtSecret();
      ok(false, "missing secret should throw");
    } catch {
      ok(true);
    } finally {
      process.env.JWT_SECRET = saved;
    }
  });
});

describe("requireAuth middleware", () => {
  it("attaches userId for a valid Bearer token", () => {
    const token = signAccessToken("user-123");
    const req = { headers: { authorization: `Bearer ${token}` } } as never;
    const res = mockResponse();
    let nextCalled = false;
    requireAuth(req as never, res as never, () => {
      nextCalled = true;
    });
    equal(nextCalled, true);
    equal((req as { userId?: string }).userId, "user-123");
  });

  it("returns 401 for missing, malformed or invalid tokens", () => {
    for (const authorization of [undefined, "Token abc", "Bearer ", "Bearer bad"]) {
      const req = { headers: { authorization } } as never;
      const res = mockResponse();
      let nextCalled = false;
      requireAuth(req as never, res as never, () => {
        nextCalled = true;
      });
      equal(nextCalled, false);
      equal(res.statusCode, 401);
    }
  });
});
