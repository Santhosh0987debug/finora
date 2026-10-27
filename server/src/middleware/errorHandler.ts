import type { NextFunction, Request, Response } from "express";

export function notFoundHandler(_req: Request, res: Response): void {
  res.status(404).json({ error: "Not found" });
}

// Centralized error handler. Responds with a generic message so stack
// traces and implementation details never leak to clients. Only the
// message is logged server-side — never tokens, passwords, or secrets.
export function errorHandler(
  err: unknown,
  _req: Request,
  res: Response,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _next: NextFunction,
): void {
  // eslint-disable-next-line no-console
  console.error(err instanceof Error ? err.message : err);
  if (res.headersSent) {
    return;
  }
  res.status(500).json({ error: "Internal server error" });
}
