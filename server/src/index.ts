import cors from "cors";
import dotenv from "dotenv";
import express, { type Request, type Response } from "express";
import { getJwtSecret } from "./lib/jwt";
import { errorHandler, notFoundHandler } from "./middleware/errorHandler";
import accountsRoutes from "./routes/accounts";
import authRoutes from "./routes/auth";
import billsRoutes from "./routes/bills";
import budgetsRoutes from "./routes/budgets";
import categoriesRoutes from "./routes/categories";
import dashboardRoutes from "./routes/dashboard";
import potsRoutes from "./routes/pots";
import transactionsRoutes from "./routes/transactions";

dotenv.config();

// Fail fast when auth cannot be secured — the server must never run
// with a missing or weak JWT secret.
getJwtSecret();

const app = express();
const PORT = Number(process.env.PORT) || 4000;

// Environment-based CORS. When FRONTEND_ORIGIN is set (comma-separated),
// only those origins are allowed. No wildcard + credentials combination
// is used (this API authenticates via Bearer tokens, not cookies).
const allowedOrigins = (process.env.FRONTEND_ORIGIN ?? "")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

app.use(
  allowedOrigins.length > 0 ? cors({ origin: allowedOrigins }) : cors(),
);
app.use(express.json());

app.get("/api/health", (_req: Request, res: Response) => {
  res.status(200).json({
    status: "ok",
    message: "Backend is running",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

app.get("/", (_req: Request, res: Response) => {
  res.status(200).json({
    name: "finora-server",
    status: "ok",
    health: "/api/health",
  });
});

app.use("/api/auth", authRoutes);
app.use("/api/accounts", accountsRoutes);
app.use("/api/budgets", budgetsRoutes);
app.use("/api/categories", categoriesRoutes);
app.use("/api/transactions", transactionsRoutes);
app.use("/api/dashboard", dashboardRoutes);
app.use("/api/pots", potsRoutes);
app.use("/api/bills", billsRoutes);

app.use(notFoundHandler);
app.use(errorHandler);

app.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`finora-server listening on http://localhost:${PORT}`);
});

export default app;
