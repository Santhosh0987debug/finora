import type { NextFunction, Request, Response } from "express";
import { verifyAccessToken } from "../lib/jwt";

export function requireAuth(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  const header = req.headers.authorization;
  if (!header || !header.startsWith("Bearer ")) {
    res.status(401).json({ error: "Authentication required" });
    return;
  }
  const token = header.slice("Bearer ".length).trim();
  if (!token) {
    res.status(401).json({ error: "Authentication required" });
    return;
  }
  try {
    req.userId = verifyAccessToken(token);
    next();
  } catch {
    // Generic message: no detail about why the token failed.
    res.status(401).json({ error: "Invalid or expired token" });
  }
}
