# Replit Federal Credit Union (RFCU) - Dummy Bank Web App

## Overview

This is a **Credit Union simulation web application** (RFCU - Replit Federal Credit Union) built as a Masters-level demo project. It simulates core banking/credit union operations including member registration, account management, transactions (deposits, transfers, bill pay), staff/admin tools, and audit logging. The currency is USD and the app uses credit union terminology (Members, Share Accounts, Staff/Teller).

This is **not** a real banking application — it's a realistic simulation with proper security patterns (password hashing, sessions, server-side validation, audit logs, database transactions for money transfers).

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Full-Stack Monorepo Structure
The project is a single repository with three main directories:
- **`client/`** — React frontend (SPA)
- **`server/`** — Express.js backend (API server)
- **`shared/`** — Shared TypeScript types, schemas, and route definitions used by both client and server

### Frontend (`client/`)
- **Framework:** React 18 with TypeScript
- **Routing:** Wouter (lightweight client-side router)
- **State/Data fetching:** TanStack React Query for server state management
- **UI Components:** shadcn/ui (new-york style) built on Radix UI primitives
- **Styling:** Tailwind CSS with CSS variables for theming (light/dark mode support)
- **Forms:** React Hook Form with Zod validation via `@hookform/resolvers`
- **Fonts:** Outfit (display) and Plus Jakarta Sans (body)
- **Build tool:** Vite
- **Key pages:** AuthPage (login/register), CustomerDashboard, TransactionPage, AdminDashboard, ApplyPage (loan/equity/CC forms), CryptoPage (crypto trading), MobileDepositPage (check deposits)
- **Path aliases:** `@/` maps to `client/src/`, `@shared/` maps to `shared/`

### Backend (`server/`)
- **Framework:** Express.js v5 running on Node.js via tsx
- **Authentication:** Passport.js with local strategy (username/password), express-session with MemoryStore
- **Password security:** Node.js crypto `scrypt` for password hashing (timing-safe comparison)
- **API design:** RESTful JSON API under `/api/*` prefix. Route contracts defined in `shared/routes.ts` with Zod schemas for input validation and response types
- **Role-based access:** Two roles — `member` (customer) and `staff` (admin/teller). Frozen users cannot log in or transact
- **Session storage:** MemoryStore in development (consider connect-pg-simple for production)

### Database
- **ORM:** Drizzle ORM with PostgreSQL dialect
- **Database:** PostgreSQL (required — `DATABASE_URL` environment variable must be set)
- **Schema location:** `shared/schema.ts`
- **Migrations:** Drizzle Kit (`drizzle-kit push` via `npm run db:push`), migrations output to `./migrations/`
- **Key tables:**
  - `users` — Members and staff with roles, status (active/frozen), member numbers, dashboard widget preferences
  - `accounts` — Share Savings and Checking accounts with balances (decimal precision 15,2), account numbers, status
  - `account_applications` — Workflow for account opening approval (pending → approved/rejected)
  - `transactions` — Ledger-style transaction log (deposit, transfer, billpay, adjustment_credit, adjustment_debit, mobile_deposit) with references, status, reason codes, staff user tracking
  - `mobile_deposits` — Mobile check deposit submissions with check image URLs, amount, approval status, staff reviewer
  - `crypto_holdings` — Cryptocurrency holdings per user with symbol, name, and amount (decimal 18,8)
  - `audit_logs` — Security audit trail for all significant actions

### Storage Layer
- `server/storage.ts` defines an `IStorage` interface and `DatabaseStorage` implementation
- All database operations go through this storage abstraction
- Atomic transactions for transfers (debit + credit in single DB transaction)
- Negative balance prevention
- Failed transactions are recorded with status and reason

### Build & Development
- **Dev:** `npm run dev` — runs tsx to start Express server with Vite dev middleware (HMR)
- **Build:** `npm run build` — Vite builds the client to `dist/public/`, esbuild bundles the server to `dist/index.cjs`
- **Production:** `npm start` — serves the built app with Express static file serving
- **Type checking:** `npm run check` — runs TypeScript compiler
- **DB sync:** `npm run db:push` — pushes schema to database

### Key Design Decisions
1. **Shared route contracts** (`shared/routes.ts`): Both client and server import the same Zod schemas and route definitions, ensuring type-safe API communication without code generation
2. **Ledger-based balance management**: Balances are modified through transactions only. Admin balance adjustments create proper ledger entries (adjustment_credit/adjustment_debit) rather than direct edits
3. **Account application workflow**: New accounts require staff approval before creation. Loan, home equity, and credit card applications store detailed form data (employment, income, property details) as JSONB for staff review
4. **Cryptocurrency trading**: Simulated prices for 8 cryptocurrencies (BTC, ETH, SOL, ADA, DOT, LINK, XRP, DOGE) with server-side price validation. Buy/sell operations deduct/credit linked checking or savings accounts
5. **Mobile check deposits**: Members submit check deposits (simulated camera capture) pending staff approval. Approved deposits credit the target account and create transaction records
6. **Audit logging**: All significant actions (login, registration, transactions, crypto trades, mobile deposits, admin operations) are logged for accountability

## External Dependencies

### Required Services
- **PostgreSQL Database** — Required. Must be provisioned and `DATABASE_URL` environment variable must be set. The app will crash on startup without it.

### Environment Variables
- `DATABASE_URL` — PostgreSQL connection string (required)
- `SESSION_SECRET` — Session encryption key (defaults to a hardcoded fallback in development, should be set in production)

### Key NPM Packages
- **drizzle-orm** + **drizzle-kit** — ORM and migration tooling for PostgreSQL
- **express** v5 — HTTP server
- **passport** + **passport-local** — Authentication
- **express-session** + **memorystore** — Session management
- **@tanstack/react-query** — Client-side server state
- **zod** + **drizzle-zod** — Schema validation (shared between client/server)
- **shadcn/ui** components (Radix UI primitives) — UI component library
- **recharts** — Transaction analytics charts
- **date-fns** — Date formatting
- **wouter** — Client-side routing
- **react-hook-form** — Form management

### Replit-Specific Plugins
- `@replit/vite-plugin-runtime-error-modal` — Error overlay in development
- `@replit/vite-plugin-cartographer` — Dev tooling (dev only)
- `@replit/vite-plugin-dev-banner` — Dev banner (dev only)