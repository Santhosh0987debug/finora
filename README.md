# Finora — Personal Finance App

Production-quality personal finance dashboard with accounts, transactions,
budgets, pots, recurring bills, and a summary dashboard.

## Tech stack

- Frontend: React + Vite + TypeScript + Tailwind CSS (`client/`)
- Backend: Node.js + Express + TypeScript (`server/`)
- Database: PostgreSQL (Neon) with Prisma ORM v6
  (`server/prisma/schema.prisma`)
- Auth: JWT with bcrypt password hashing
- Deploy: Vercel (frontend), Render (backend)

## Prerequisites

- Node.js >= 20 (LTS recommended) and npm >= 10
- PostgreSQL >= 15 (required to run migrations and the app with a database)
- Git (recommended)
- PowerShell 5.1+ or any modern shell (examples show both)

Check versions:

```powershell
node --version
npm --version
psql --version
```

## Project structure

```text
Finora/
  package.json          # root workspace scripts (client + server)
  client/               # Vite + React + TS + Tailwind frontend
    .env.example        # VITE_API_URL placeholder
    src/App.tsx         # app shell, auth gate, and page navigation
    src/index.css       # Tailwind v4 import
  server/               # Express + TS backend
    src/index.ts        # app, CORS, and GET /api/health
    src/lib/prisma.ts   # PrismaClient singleton
    prisma/
      schema.prisma     # PostgreSQL schema: all models + enums
      migrations/       # committed migration history
      seed.ts           # idempotent default-category seed
    .env.example        # PORT / DATABASE_URL / JWT_SECRET / FRONTEND_ORIGIN
```

## Setup

```powershell
# 1. Install all workspaces from the repo root
npm install

# 2. (Optional) local env files — placeholders only, no real secrets
Copy-Item client/.env.example client/.env
Copy-Item server/.env.example server/.env
```

```bash
# bash equivalents
# npm install
# cp client/.env.example client/.env
# cp server/.env.example server/.env
```

## Development

```powershell
# Frontend (http://localhost:5173 by default)
npm run dev:client

# Backend (http://localhost:4000 by default)
npm run dev:server
```

Health check:

```powershell
Invoke-RestMethod http://localhost:4000/api/health
```

```bash
curl http://localhost:4000/api/health
```

Expected:

```json
{
  "status": "ok",
  "message": "Backend is running",
  "timestamp": "2026-01-01T00:00:00.000Z",
  "uptime": 1.23
}
```

## Production builds

```powershell
# Both
npm run build

# Individually
npm run build:client
npm run build:server

# Run built backend
npm run start:server
```

## Production deployment

The database stays on Neon. Deploy the backend to Render and the frontend to
Vercel. Never commit `.env` files or secret values.

### Backend — Render Web Service

- Runtime: Node, Node.js version `22`
- Root Directory: repository root (leave blank)
- Build Command:

  ```bash
  npm ci --include=dev && npm run prisma:generate --workspace=server && npm run build:server
  ```

- Pre-Deploy Command:

  ```bash
  npm run prisma:migrate:deploy --workspace=server
  ```

- Start Command:

  ```bash
  npm run start:server
  ```

- Health Check Path: `/api/health`
- Environment variables:
  - `DATABASE_URL` — Neon PostgreSQL pooled connection string
  - `JWT_SECRET` — strong random value, at least 16 characters
  - `FRONTEND_ORIGIN` — production Vercel origin, for example
    `https://finora.vercel.app` (comma-separated for preview origins; no
    trailing slashes)
  - `NODE_ENV` — `production`
  - `NODE_VERSION` — `22`
  - Do not set `PORT`; Render provides it automatically.

Prisma Client is generated during the build. `prisma migrate deploy` applies
only committed migrations and is the production migration command. The
idempotent category seed (`npm run db:seed --workspace=server`) is only needed
once if the database has no categories; it never creates financial records.

### Frontend — Vercel

- Framework Preset: Vite
- Root Directory: `client`
- Install Command: `npm ci --include=dev`
- Build Command: `npm run build`
- Output Directory: `dist`
- Node.js Version: `22.x`
- Environment variable (Production and Preview as needed):
  - `VITE_API_URL` — deployed Render URL, for example
    `https://finora-api.onrender.com` (no trailing slash)

`VITE_API_URL` is embedded at build time, so changing it requires a new Vercel
deployment. No rewrite rules are needed because page navigation is state-based,
not client-side URL routing.

## Database (PostgreSQL + Prisma)

Prisma version: v6 (`prisma` + `@prisma/client` in `server/`).
Schema: `server/prisma/schema.prisma`. Models: `User`, `Account`,
`Category`, `Transaction`, `Budget`, `Pot`, `RecurringBill`.
All money fields use Prisma `Decimal` → PostgreSQL `NUMERIC(12, 2)`
(decimal-safe; no floating-point storage for financial amounts).

### 1. Install PostgreSQL and create the database

```powershell
# After installing PostgreSQL 15+, create the database:
createdb finora
# (or via psql: CREATE DATABASE finora;)
```

### 2. Configure DATABASE_URL (placeholders only — never commit secrets)

```powershell
Copy-Item server/.env.example server/.env
```

Then edit `server/.env` with your local values (example format only):

```text
PORT=4000
DATABASE_URL=postgresql://USER:PASSWORD@localhost:5432/finora
JWT_SECRET=your-local-dev-secret
```

### 3. Prisma commands (run from `server/`)

```powershell
cd server

# Validate the schema (no database needed)
npx prisma validate

# Generate the Prisma client (no database needed)
npm run prisma:generate

# Development only: create/apply a migration (needs live DATABASE_URL)
npm run prisma:migrate
# give the migration a name when prompted, e.g. `init`

# Production: apply committed migrations only (no schema drift prompts)
npm run prisma:migrate:deploy

# Seed default transaction categories (safe to rerun; upserts only,
# never inserts financial transactions)
npm run db:seed
```

### 4. Verify database connectivity

```powershell
cd server

# Opens Prisma Studio in the browser to inspect tables
npm run prisma:studio

# Or query directly:
psql $env:DATABASE_URL -c "\dt"
```

Expected tables: `User`, `Account`, `Category`, `Transaction`, `Budget`,
`Pot`, `RecurringBill`, plus Prisma's `_prisma_migrations`.

## Notes

- `.env` files are git-ignored; only `.env.example` placeholders are committed.
- The seed script only creates default categories and is idempotent.
- Every finance resource is scoped to the authenticated user in the API.
- `prisma migrate dev` is for local development; production uses
  `prisma migrate deploy`.
