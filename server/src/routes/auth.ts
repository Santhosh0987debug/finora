import { Router, type Request, type Response } from "express";
import type { User } from "@prisma/client";
import { asyncHandler } from "../middleware/asyncHandler";
import { requireAuth } from "../middleware/requireAuth";
import { signAccessToken } from "../lib/jwt";
import { hashPassword, verifyPassword } from "../lib/password";
import { prisma } from "../lib/prisma";
import { loginSchema, registerSchema } from "../schemas/auth";

const router = Router();

// Public profile shape — passwordHash is never selected or returned.
function toSafeUser(user: Pick<User, "id" | "name" | "email" | "createdAt" | "updatedAt">) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}

function validationError(res: Response, issues: { message: string }[]): Response {
  return res
    .status(400)
    .json({ error: issues[0]?.message ?? "Invalid request" });
}

router.post(
  "/register",
  asyncHandler(async (req: Request, res: Response): Promise<Response> => {
    const parsed = registerSchema.safeParse(req.body);
    if (!parsed.success) {
      return validationError(res, parsed.error.issues);
    }
    // Email is already normalized (trimmed + lowercased) by the schema.
    // The authenticated identity always comes from the database/JWT —
    // never from a userId in the request body.
    const { name, email, password } = parsed.data;

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return res.status(409).json({ error: "Email is already registered" });
    }

    const passwordHash = await hashPassword(password);
    const user = await prisma.user.create({
      data: { name, email, passwordHash },
    });

    return res.status(201).json({
      user: toSafeUser(user),
      token: signAccessToken(user.id),
    });
  }),
);

router.post(
  "/login",
  asyncHandler(async (req: Request, res: Response): Promise<Response> => {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) {
      return validationError(res, parsed.error.issues);
    }
    const { email, password } = parsed.data;

    const user = await prisma.user.findUnique({ where: { email } });
    // Generic response for both unknown email and wrong password so
    // attackers cannot enumerate registered emails.
    if (!user || !(await verifyPassword(password, user.passwordHash))) {
      return res.status(401).json({ error: "Invalid email or password" });
    }

    return res.status(200).json({
      user: toSafeUser(user),
      token: signAccessToken(user.id),
    });
  }),
);

router.get(
  "/me",
  requireAuth,
  asyncHandler(async (req: Request, res: Response): Promise<Response> => {
    const user = await prisma.user.findUnique({
      where: { id: req.userId ?? "" },
    });
    if (!user) {
      return res.status(401).json({ error: "Invalid or expired token" });
    }
    return res.status(200).json({ user: toSafeUser(user) });
  }),
);

export default router;
