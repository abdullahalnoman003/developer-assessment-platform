<div align="center">

# CodeArena — Developer Assessment Platform

**Build assessments · Invite candidates · Run timed attempts · Grade & report — all through one API**

</div>

| | | | | |
|---|---|---|---|---|
| ![Node.js](https://img.shields.io/badge/Node.js-339933?style=flat&logo=nodedotjs&logoColor=white) | ![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?style=flat&logo=typescript&logoColor=white) | ![Express](https://img.shields.io/badge/Express-5-000000?style=flat&logo=express&logoColor=white) | ![PostgreSQL](https://img.shields.io/badge/PostgreSQL-4169E1?style=flat&logo=postgresql&logoColor=white) | ![Prisma](https://img.shields.io/badge/Prisma-7-2D3748?style=flat&logo=prisma&logoColor=white) |
| ![Zod](https://img.shields.io/badge/Zod-3E67B1?style=flat&logo=zod&logoColor=white) | ![JWT](https://img.shields.io/badge/JWT-Auth-000000?style=flat&logo=jsonwebtoken&logoColor=white) | ![Stripe](https://img.shields.io/badge/Stripe-Payments-635BFF?style=flat&logo=stripe&logoColor=white) | ![Biome](https://img.shields.io/badge/Biome-Lint-60A5FA?style=flat&logo=biome&logoColor=white) | ![Vercel](https://img.shields.io/badge/Deploy-Vercel-000000?style=flat&logo=vercel&logoColor=white) |

---

## 📌 Overview

CodeArena is a **multi-tenant, role-secured REST API** that replaces the spreadsheet-and-email chaos of technical hiring with one complete flow: build an assessment from a question bank, invite candidates, run timed attempts with server-enforced deadlines, auto-grade MCQs, manually evaluate written answers, and view results — with real Stripe payments for credits.

**In short:** 32 endpoints · 3 roles · 12 database tables · 1 end-to-end hiring workflow.

### Feature Highlights

- 🏢 **Multi-tenant question banks & assessments** — every query scoped by the recruiter's company
- ⏱️ **Server-secured attempt timer** — deadline computed and enforced server-side, never trusted from the client
- ✅ **Auto-grading for MCQ** + manual grading for written/coding answers
- 🔄 **Full state machines** for assessments, attempts, and invitations
- 🔒 **Idempotent Stripe payments** — webhook signature-verified, replay-safe credit grants
- 🛡️ **RBAC with 3 roles**, JWT + refresh rotation, Google OAuth, rate limiting, soft deletes, audit logs

---

## Table of Contents

- [How It Works](#how-it-works)
- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [Roles & Permissions](#roles--permissions)
- [Database Schema](#database-schema)
- [Entity Relationships](#entity-relationships)
- [State Machines](#state-machines)
- [API Reference](#api-reference)
- [Business Logic & Design Decisions](#business-logic--design-decisions)
- [Getting Started](#getting-started)
- [Environment Variables](#environment-variables)
- [Deployment](#deployment)
- [Demo Accounts](#demo-accounts)

---

## How It Works

```
┌──────────────────────────────────────────────────────────────────────┐
│                         RECRUITER FLOW                               │
│                                                                      │
│  1. Register/Login → Create Company Profile                          │
│  2. Build Question Bank (MCQ, Written, Coding)                       │
│  3. Create Assessment → Add Questions from Bank                       │
│  4. Publish Assessment                                                │
│  5. Invite Candidates by Email (bulk)                                 │
│  6. Review Submissions → Grade Written Answers → Release Results      │
│  7. View Dashboard & Reports                                          │
└──────────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────────┐
│                         CANDIDATE FLOW                               │
│                                                                      │
│  1. Register/Login → Complete Profile                                 │
│  2. View Invitations                                                  │
│  3. Accept Invitation → Start Timed Attempt                           │
│  4. Answer Questions (save progress as you go)                        │
│  5. Submit → Auto-grading (MCQ) + Manual grading (Written)           │
│  6. View Released Results                                             │
└──────────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────────┐
│                          ADMIN FLOW                                  │
│                                                                      │
│  1. Login → View Platform-wide Stats                                  │
│  2. Manage Users (suspend/restore)                                    │
│  3. Moderate Assessments & Question Bank                              │
│  4. Review Audit Logs                                                 │
└──────────────────────────────────────────────────────────────────────┘
```

---

## Tech Stack

| Layer | Technology |
|---|---|
| **Runtime** | Node.js |
| **Language** | TypeScript (strict mode, ESM) |
| **Framework** | Express 5 |
| **Database** | PostgreSQL |
| **ORM** | Prisma 7 (multi-file schema, `@prisma/adapter-pg`) |
| **Validation** | Zod v4 |
| **Authentication** | JWT (access + refresh tokens), Google OAuth |
| **Payment** | Stripe |
| **Linting/Formatting** | Biome |
| **Bundler** | tsup (ESM output) |
| **Deployment** | Vercel (serverless) |
| **Runtime (dev)** | tsx (watch mode) |

---

## Project Structure

```
backend/
├── prisma/
│   ├── schema/                 # Multi-file Prisma schema
│   │   ├── schema.prisma       # Generator + datasource
│   │   ├── user.prisma         # User model + ALL enums
│   │   ├── company.prisma
│   │   ├── companyMemberShip.prisma
│   │   ├── question.prisma
│   │   ├── assesment.prisma
│   │   ├── assesmentQuestion.prisma
│   │   ├── invition.prisma
│   │   ├── attempt.prisma
│   │   ├── answer.prisma
│   │   ├── payment.prisma
│   │   ├── auditlog.prisma
│   │   └── refreshToken.prisma
│   └── migrations/
├── generated/prisma/           # Prisma client output (gitignored, run prisma generate)
├── src/
│   ├── app.ts                  # Express app setup, middleware, route mounting
│   ├── server.ts               # Entry point — DB connect + listen (skipped on Vercel)
│   ├── config/
│   │   └── index.ts            # Environment variable loader with validation
│   ├── global/
│   │   ├── apperror.ts         # Custom AppError class
│   │   └── globalErrorhandler.ts  # Centralized error handler (AppError, Zod, JWT, Prisma)
│   ├── lib/
│   │   └── prisma.ts           # PrismaClient singleton with PgAdapter
│   ├── middleware/
│   │   └── auth.middleware.ts  # JWT verification + role-based access control
│   ├── modules/
│   │   ├── auth/               # Register, Login, Google OAuth, Refresh Token
│   │   ├── user/               # Profile get/update
│   │   ├── company/            # Company upsert (multi-tenant root)
│   │   ├── question/           # Question bank CRUD + search/filter
│   │   ├── assessment/         # Assessment CRUD + question assignment + status transitions
│   │   ├── invitation/         # Bulk invite, accept/decline
│   │   ├── attempt/            # Start, save answers, submit, evaluate, results
│   │   ├── payment/            # Stripe checkout, webhook, idempotent credit grant
│   │   └── admin/              # User management, stats, audit logs
│   └── seed/
│       └── index.ts            # Demo account seeder (Admin, Recruiter, Candidate)
├── .env.example                # Environment variable template
├── biome.json                  # Biome config (4-space indent, double quotes, semicolons)
├── prisma7.config.ts           # Prisma CLI config
├── tsconfig.json               # TypeScript config (strict, ESM, bundler resolution)
├── tsup.config.ts              # Bundler config for Vercel deployment
├── vercel.json                 # Vercel serverless routing
└── package.json
```

Each module follows a consistent internal structure:

```
modules/<module>/
├── <module>.route.ts     # Route definitions + middleware chain
├── <module>.controller.ts  # Thin handler — parse request, call service, send response
├── <module>.service.ts     # Business logic, Prisma queries, validation
└── <module>.interface.ts   # TypeScript types/interfaces for the module
```

---

## Roles & Permissions

### Three Roles

| Role | Description |
|---|---|
| **CANDIDATE** | Takes assessments, manages profile, views results |
| **RECRUITER** | Creates assessments, manages question bank, invites candidates, grades, views reports |
| **ADMIN** | Platform-wide user management, audit logs, stats, moderation |

### Permission Matrix

| Action | Candidate | Recruiter | Admin |
|---|:---:|:---:|:---:|
| Register / Login | Yes | Yes | Login only |
| Manage own profile | Yes | Yes | Yes |
| Manage own company | — | Yes | Yes |
| Manage questions (own company) | — | Yes | Yes (all) |
| Manage assessments (own company) | — | Yes | Yes (all) |
| Invite candidates | — | Yes | Yes |
| Start / answer / submit attempt | Yes | — | — |
| Evaluate written answers | — | Yes (own) | Yes |
| View own result (if released) | Yes | — | — |
| View company results / reports | — | Yes | Yes |
| Payments | — | Yes | View only |
| User management / audit logs | — | — | Yes |

---

## Database Schema

### Enums

| Enum | Values |
|---|---|
| `UserRole` | `CANDIDATE`, `RECRUITER`, `ADMIN` |
| `AuthProvider` | `LOCAL`, `GOOGLE` |
| `UserStatus` | `ACTIVE`, `SUSPENDED` |
| `AssessmentStatus` | `DRAFT`, `PUBLISHED`, `CLOSED`, `ARCHIVED` |
| `QuestionType` | `MCQ`, `WRITTEN`, `CODING` |
| `Difficulty` | `EASY`, `MEDIUM`, `HARD` |
| `InvitationStatus` | `PENDING`, `ACCEPTED`, `DECLINED`, `EXPIRED` |
| `AttemptStatus` | `NOT_STARTED`, `IN_PROGRESS`, `SUBMITTED`, `EVALUATED`, `EXPIRED` |
| `PaymentStatus` | `PENDING`, `PAID`, `FAILED`, `REFUNDED` |
| `PaymentProvider` | `BKASH`, `STRIPE`, `SSLCOMMERZ` |

### Tables

| Table | Purpose |
|---|---|
| `Users` | All users — candidates have extra profile fields (phone, bio, skills, resume, github) |
| `CompanyMembership` | Links a user to a company (1:1 per user) |
| `Companies` | Recruiter-owned companies with credit balance |
| `Questions` | Company-scoped question bank (MCQ with options, Written, Coding) |
| `Assessments` | Titled, timed assessments with lifecycle status |
| `AssessmentQuestions` | Join table — which questions in which assessment, with points and ordering |
| `Invitations` | Recruiter sends to candidates — unique token, expiry, accept/decline status |
| `Attempts` | One per invitation — tracks timer, answers, score, evaluation, result release |
| `Answers` | Per-question responses within an attempt |
| `Payments` | Stripe transactions linked to companies — providerRef for idempotency |
| `AuditLogs` | Tracks critical actions (user status changes, assessment transitions, payments) |
| `RefreshTokens` | Hashed, rotatable, revocable refresh tokens per user |

---

## Entity Relationships

```
User ──────────< CompanyMembership >────────── Company
  │                                            │ │ │
  │ (invitations)                              │ │ └──< Payments
  │                                            │ └────< Assessments ──< AssessmentQuestions >── Questions
  │                                            └──────< Questions
  │
  ├──< Invitations ──1:1── Attempts ──< Answers
  │
  └──< AuditLogs
```

**Key design choice:** `Submission`, `Evaluation`, and `Result` are folded into the `Attempt` model as status fields and score columns — not separate tables. An attempt naturally *is* the submission; its evaluation is a lifecycle state, not a separate entity requiring its own CRUD API.

---

## State Machines

### Assessment Lifecycle

```
DRAFT ──> PUBLISHED ──> CLOSED ──> ARCHIVED
```

- Questions can only be added/reordered while in `DRAFT`
- One-directional: once published, you can't go back to draft — only close or archive

### Attempt Lifecycle

```
NOT_STARTED ──> IN_PROGRESS ──> SUBMITTED ──> EVALUATED
                         │
                         └──> EXPIRED (if deadline passes)
```

- Deadline is computed server-side: `startedAt + assessment.durationMins`
- Every read/write on an attempt checks deadline expiry first
- Submission uses a conditional `WHERE status = 'IN_PROGRESS'` to prevent double-submit races

### Invitation Lifecycle

```
PENDING ──> ACCEPTED / DECLINED / EXPIRED
```

---

## API Reference

**Base URL:** `https://<deployed-url>/api/v1`

**Response Format:**

```jsonc
// Success
{ "success": true, "message": "Operation successful", "data": { ... } }

// Error
{ "success": false, "message": "Something went wrong", "errors": [] }
```

### Auth (4 endpoints)

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| POST | `/auth/register` | Public | Register as candidate or recruiter |
| POST | `/auth/login` | Public | Email + password login |
| POST | `/auth/google` | Public | Google OAuth login/register |
| POST | `/auth/refresh-token` | Public | Rotate refresh token → new token pair |

### Users (2 endpoints)

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| GET | `/users/me` | Any authenticated | Get own profile |
| PATCH | `/users/me` | Any authenticated | Update profile (recruiters: name/avatar; candidates: + phone, bio, skills, resume, github) |

### Companies (2 endpoints)

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| GET | `/companies/me` | Recruiter/Admin | Get own company profile |
| PUT | `/companies/me` | Recruiter | Upsert company (creates on first call, updates after) |

### Questions (3 endpoints)

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| POST | `/questions` | Recruiter | Create question in company bank |
| GET | `/questions` | Recruiter | List/search/filter with `?type=&difficulty=&q=&page=&limit=` |
| PATCH | `/questions/:id` | Recruiter | Update fields or soft-delete via `{ "deletedAt": "now" }` |

### Assessments (4 endpoints)

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| POST | `/assessments` | Recruiter | Create assessment |
| GET | `/assessments` | Recruiter | List with `?status=&sortBy=&page=&limit=` |
| GET | `/assessments/:id` | Recruiter | Get assessment detail (questions, invitation count, stats) |
| PATCH | `/assessments/:id` | Recruiter | Multi-purpose: edit details, replace questions (DRAFT only), or transition status |

### Invitations (3 endpoints)

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| POST | `/assessments/:id/invitations` | Recruiter | Bulk invite via `{ candidateEmails: [...] }` |
| GET | `/invitations/me` | Candidate | View own invitations |
| PATCH | `/invitations/:id` | Candidate/Recruiter | Accept, decline, or revoke |

### Attempts (3 endpoints)

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| POST | `/invitations/:id/start` | Candidate | Start timed attempt, sets server-side deadline |
| PATCH | `/attempts/:id` | Candidate | Save progress `{ answers: [...] }` or submit `{ status: "SUBMITTED" }` |
| GET | `/attempts/:id` | Candidate (own) / Recruiter (own assessment) | Full attempt state with answers and score |

### Evaluation & Results (2 endpoints)

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| POST | `/attempts/:id/evaluate` | Recruiter | Grade written answers, optionally release result |
| GET | `/assessments/:id/results` | Recruiter | Paginated candidate results for an assessment |

### Dashboard (1 endpoint)

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| GET | `/companies/me/dashboard` | Recruiter | Assessment counts, invitation funnel, avg score, credit balance |

### Payments (4 endpoints)

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| POST | `/payments/initiate` | Recruiter | Start Stripe checkout session |
| POST | `/payments/webhook` | Public (Stripe-signed) | Idempotent webhook — verifies signature, grants credits |
| GET | `/payments/:id` | Recruiter/Admin | Get single payment |
| GET | `/payments` | Recruiter | Paginated payment history for own company |

### Admin (4 endpoints)

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| GET | `/admin/users` | Admin | List users with `?role=&status=&q=&page=&limit=` |
| PATCH | `/admin/users/:id` | Admin | Suspend or restore a user |
| GET | `/admin/stats` | Admin | Platform-wide statistics |
| GET | `/admin/audit-logs` | Admin | Paginated audit trail with `?entity=&page=&limit=` |

**Total: 32 endpoints**

---

## Business Logic & Design Decisions

### Multi-Tenancy

Every question, assessment, and payment query is scoped by `companyId` derived from the authenticated recruiter's `CompanyMembership`. The `companyId` is **never** taken from the request body — it's always derived server-side from the JWT user.

### Attempt Timer Security

The `deadline` field is computed and stored **server-side** at attempt start (`startedAt + assessment.durationMins`). The client never sends or influences the deadline. On every read/write against an attempt, the server checks if the deadline has passed and flips the status to `EXPIRED` if so.

### Concurrency & Race Condition Prevention

Attempt submission uses a conditional update (`WHERE status = 'IN_PROGRESS'`) — if two submits arrive simultaneously, only the first succeeds. The second fails gracefully instead of double-scoring.

### Payment Idempotency

The Stripe webhook is keyed on `providerRef` (a unique constraint). A replayed webhook event is a no-op — the second call returns 200 but doesn't double-grant credits. Payment status is **only** set to `PAID` from a verified webhook call, never from a client-facing endpoint.

### Transactions

Prisma `$transaction` is used for:
- Attempt submission + auto-grading + score calculation
- Payment webhook status update + credit grant
- Assessment publish (locks question set)

### Auto-Grading

MCQ answers are auto-graded on submission by comparing the selected option against `correctAnswer`. Written and coding answers are graded manually by the recruiter through the evaluation endpoint.

### Validation

Every endpoint uses Zod schemas for request body validation. Validation errors are caught by the global error handler and returned in the standard error format.

### Rate Limiting

A global rate limiter (`100 requests / 15 minutes`) is applied to all `/api/v1` routes. The Stripe webhook endpoint is excluded to avoid dropping payment events.

### Soft Deletes

Users, companies, questions, and assessments use a `deletedAt` timestamp for soft deletion — records are never physically removed from the database.

### Audit Logging

Critical actions are logged to the `AuditLogs` table:
- User suspend/restore
- Assessment status transitions
- Payment status changes
- Result releases

---

## Getting Started

### Prerequisites

- Node.js (v18+)
- PostgreSQL
- npm

### Installation

```bash
# Clone the repository
git clone https://github.com/abdullahalnoman003/developer-assessment-platform.git
cd developer-assessment-platform/backend

# Install dependencies
npm install

# Generate Prisma client
npx prisma generate

# Set up environment variables
cp .env.example .env
# Edit .env with your database URL, JWT secrets, and Stripe keys

# Push schema to database
npx prisma db push

# Start development server
npm run dev
```

The server starts on the port specified in `.env` (default: `5000`). Demo accounts for all three roles are automatically seeded on first boot.

### Available Scripts

| Script | Description |
|---|---|
| `npm run dev` | Start dev server with hot reload (tsx watch) |
| `npm run build` | Build ESM bundle to `dist/` (required before deployment) |
| `npm start` | Run built output from `dist/server.js` |
| `npx prisma generate` | Regenerate Prisma client (run after schema changes) |
| `npx prisma db push` | Push schema changes to database |
| `npx tsc --noEmit` | Type-check without emitting files |
| `npx biome check <file>` | Lint/format a single file |

---

## Environment Variables

Copy `.env.example` to `.env` and configure:

```env
# Database
DATABASE_URL="postgresql://user:password@localhost:5432/codearena?schema=public"

# App
PORT=5000
APP_URL="http://localhost:5000"
FRONTEND_URL="http://localhost:3000"

# JWT (required — server won't start without these)
JWT_ACCESS_SECRET="your_access_token_secret"
JWT_REFRESH_SECRET="your_refresh_token_secret"
JWT_ACCESS_EXPIRES_IN="1d"
JWT_REFRESH_EXPIRES_IN="7d"

# Auth
BCRYPT_SALT_ROUNDS=10
GOOGLE_CLIENT_ID="your_google_client_id.apps.googleusercontent.com"

# Payment (Stripe)
STRIPE_SECRET_KEY="sk_test_..."
STRIPE_WEBHOOK_SECRET="whsec_..."

# Demo Accounts (optional overrides)
DEMO_ADMIN_EMAIL="admin@codearena.com"
DEMO_ADMIN_PASSWORD="admin1234"
DEMO_RECRUITER_EMAIL="recruiter@codearena.com"
DEMO_RECRUITER_PASSWORD="recruiter123"
DEMO_CANDIDATE_EMAIL="candidate@codearena.com"
DEMO_CANDIDATE_PASSWORD="candidate123"
```

---

## Deployment

The project is configured for **Vercel** serverless deployment:

1. Build the project: `npm run build`
2. The `vercel.json` routes all requests to `dist/server.js`
3. The `server.ts` entry point skips `app.listen()` when `VERCEL` env is set (serverless mode)
4. The app is exported as the default export for Vercel's `@vercel/node` builder

### Important Notes

- Run `npx prisma generate` before deploying (the `generated/prisma/` directory is gitignored)
- The database must be a hosted PostgreSQL instance (e.g., Neon, Supabase, Railway)
- Stripe webhook endpoint must be configured in the Stripe dashboard pointing to your deployed URL's `/api/v1/payments/webhook`

---

## Demo Accounts

Seeded automatically on server start. Can be overridden via environment variables.

| Role | Email | Password |
|---|---|---|
| Admin | `admin@codearena.com` | `admin1234` |
| Recruiter | `recruiter@codearena.com` | `recruiter123` |
| Candidate | `candidate@codearena.com` | `candidate123` |

---

## License

This project is part of the Programming Hero Web Level 2 course assignment.