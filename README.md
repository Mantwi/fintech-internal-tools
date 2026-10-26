# Fintech Internal Tools — KYC Review Queue Prototype

A working proof of concept of a **Know Your Customer (KYC) review queue**, built to help a fintech engineering team decide whether to replace a low-code internal-tools platform (e.g. Microsoft Power Apps) with custom applications built and maintained with Devin.

> **Evaluation prototype — not a production financial system.**
> - **Authentication is simulated.** The header's *Demo Identity* switcher sets a cookie naming a seeded user. It does not verify who anyone is.
> - **Authorization is real for the selected identity.** Every protected API route and service function loads the user's role from the database and enforces permissions server-side.
> - **All customer data is synthetic.** Names, dates of birth, and SSNs are fictional (SSNs use the `900-xx-xxxx` range, which the SSA never issues).
> - Real SSO, production infrastructure, external integrations, and regulatory controls are **not** implemented.

## Purpose

Demonstrate, in one small codebase, the pieces most internal business apps need:

- Data management (searchable/filterable queue, detail view, persistent changes)
- An approval workflow with risk-based rules and separation of duties
- Server-side authorization (not just hidden buttons)
- Role-based masking of sensitive data
- An append-only audit trail
- Automated tests and a reusable structure for future apps (see [PLAYBOOK.md](./PLAYBOOK.md))

## Technology stack

- Next.js 15 (App Router) + React 19 + TypeScript
- Prisma ORM 6 with SQLite
- Zod for request validation
- Vitest for automated tests

One app contains both the UI and the API. No external services are required.

## Prerequisites

- Node.js 20 or later (developed with 20.20)
- npm 10+

## Setup and running

From a fresh clone:

```bash
npm install                 # also runs `prisma generate`
cp .env.example .env        # DATABASE_URL="file:./dev.db"
npm run db:setup            # apply migrations + seed synthetic data
npm run dev                 # http://localhost:3000
```

Individual database commands:

| Command | What it does |
| --- | --- |
| `npm run db:migrate` | Applies migrations in `prisma/migrations` to `prisma/dev.db` |
| `npm run db:seed` | **Wipes** users, cases, notes, and audit events, then re-inserts the synthetic dataset |
| `npm run db:setup` | Both of the above |

Production build: `npm run build && npm start`.

## Running the tests

```bash
npm test          # vitest run
npm run lint
npm run typecheck
```

Tests use an isolated database at `prisma/test.db`. It is deleted and recreated from the migrations at the start of each run (`tests/global-setup.ts`), and every test re-seeds it (`tests/helpers.ts`). The dev database is never touched; the reset helper refuses to run against any other `DATABASE_URL`.

What's covered:

- `tests/kyc-service.test.ts`: service-layer tests for masking, high-risk rules, separation of duties, final states, claiming, filtering, and audit events, including checks that audit payloads contain no SSNs, DOBs, or note text.
- `tests/api-routes.test.ts`: calls the real Next.js route handlers to confirm that the protected routes reject unauthorized identities (401/403), never leak PII in error responses, and validate input.

## Demo users and roles

| User | Role | Can do |
| --- | --- | --- |
| Alex Rivera | ANALYST | View queue (masked PII), claim PENDING cases, add notes, approve/reject own LOW/MEDIUM cases, escalate own cases |
| Jordan Lee | ANALYST | Same as Alex |
| Morgan Chen | COMPLIANCE_LEAD | View queue, reveal unmasked SSN/DOB (audited), add notes, escalate IN_REVIEW cases, approve/reject ESCALATED cases they did not escalate, view audit log |
| Sam Patel | COMPLIANCE_LEAD | Same as Morgan |
| Taylor Brooks | ADMIN | View queue (masked PII, cannot unmask), view audit log. Cannot change cases. |

### Workflow rules (enforced in `lib/kyc-service.ts`)

```
PENDING   --claim (analyst)----------------------------> IN_REVIEW (assigned to that analyst)
IN_REVIEW --approve/reject (assigned analyst; LOW/MED)--> APPROVED | REJECTED
IN_REVIEW --escalate (assigned analyst or any lead)----> ESCALATED
ESCALATED --approve/reject (lead ≠ escalator)----------> APPROVED | REJECTED
```

- Analysts cannot approve or reject HIGH-risk cases. HIGH-risk cases must be escalated first, and nobody can approve them before that.
- Only a COMPLIANCE_LEAD may decide an ESCALATED case, and it must be a different person from whoever escalated it.
- APPROVED and REJECTED are final: no further status changes or notes. There are no exceptions.
- Role failures return **403**; invalid state transitions return **409**; missing/unknown identity returns **401**.

## Example walkthrough

1. Open http://localhost:3000. Choose **Alex Rivera (Analyst)** in the *Demo Identity* switcher.
2. **Queue:** search "harper", or filter Status = Pending and Risk = High.
3. Open **KYC-1004**. SSN shows `***-**-1004` and DOB is masked. Alex has no reveal button, and the server returns 403 for `GET /api/cases/KYC-1004?reveal=1`.
4. Open **KYC-1006** (HIGH risk, assigned to Alex). Only *Escalate* is offered. Tick **Show all actions** and click *Approve*. The server rejects it: "Analysts cannot approve HIGH-risk cases…". Click **Escalate to compliance**.
5. Open **KYC-1001** (PENDING, LOW) → **Claim case** → add a note → **Approve**. Refresh: the status persists and the *Case history* panel shows each event.
6. Switch to **Morgan Chen (Compliance Lead)**. On KYC-1004 click **Reveal SSN & DOB (audited)**. Unmasked values appear and a `PII_UNMASKED_VIEW` event is recorded.
7. As Morgan, open **KYC-1008** (escalated *by Morgan*). Approve/Reject are not offered. With *Show all actions* ticked, *Approve* returns a separation-of-duties error.
8. Switch to **Sam Patel** and approve KYC-1008 or KYC-1006.
9. Open **Audit Log** as Sam or Taylor (admin) to see every event. As an analyst, the page and `GET /api/audit` return 403.

To start over: `npm run db:seed`.

## Project layout

```
app/
  api/                    thin route handlers (identity → validate → service → JSON)
  kyc/                    queue page, case detail page, KYC-specific components
  audit/                  audit log page
components/               reusable UI: DataTable, Badge, Card, PageHeader, ErrorState, nav, identity switcher
lib/
  auth.ts                 demo identity cookie, role→permission map, authorize()
  audit.ts                recordAuditEvent() (append-only), audit queries
  kyc-service.ts          KYC business rules, masking, transitions, audit integration
  masking.ts, errors.ts, api.ts, db.ts, ...
prisma/                   schema, migrations, synthetic seed data
tests/                    Vitest service + route tests
```

## Key design decisions

- **Business logic lives in plain functions** (`lib/kyc-service.ts`). Each function takes the caller's *user ID*, loads the user and role from the database, and authorizes before reading or writing. That makes it safe to call from routes, server components, scripts, or tests, and easy to test without a running Next.js server.
- **One rule evaluator** (`evaluateAction`) is used both to enforce actions and to compute the `allowedActions` the UI shows, so the UI and the server can't disagree.
- **Masking happens in the service** before data leaves the server. Unmasking needs an explicit `?reveal=1` request from a role with `pii:unmask`, and the audit event is written *before* the values are returned.
- **Status changes and their audit events share one transaction.** The update only applies if the case still has the status that was checked (`updateMany where status = …`), so concurrent edits fail instead of overwriting each other.
- **Audit payloads hold only non-sensitive fields.** Status/assignee before/after, note IDs (never note text), and the names of revealed fields. `recordAuditEvent` refuses keys such as `ssn`, `dateOfBirth`, or `body`.
- **Per-case history vs. global audit log:** anyone who can read a case sees that case's history on its detail page. The cross-case audit log (`/audit`, `GET /api/audit`) is limited to COMPLIANCE_LEAD and ADMIN.

## Known limitations

- **Simulated authentication.** Anyone with access to the app can pick any identity. The cookie is not signed.
- **Audit log is append-only by convention, not tamper-proof.** No API updates or deletes audit rows, but anyone with database access can. The seed script wipes the log. No retention policy, hashing/chaining, export, or centralized security monitoring.
- Reviewer notes are visible to every role that can read a case (including ADMIN) and cannot be edited or deleted.
- SQLite only and a single instance. No pagination. The audit page shows the latest 200 events.
- No reassigning/unclaiming cases, no document uploads, and no exceptions for reopening finalized cases.
- No rate limiting, CSRF tokens (beyond SameSite=Lax cookies), or security headers hardening.
- UI is functional but not tested for accessibility.

## Production requirements not implemented

- Real authentication (SSO/OIDC via the company IdP) with server-verified sessions and MFA
- Role management sourced from the IdP/HR system, with access reviews
- Managed database (e.g. Postgres) with backups, encryption at rest, and field-level encryption or tokenization for SSN/DOB
- Tamper-evident audit storage, retention policy, SIEM forwarding, and alerting on unmasked-PII access
- Integrations with KYC/identity-verification providers, sanctions/watchlist screening, and document storage
- Secrets management, CI/CD, hosting, monitoring, disaster recovery
- Regulatory review (BSA/AML, GLBA, SOC 2, state privacy laws) and formal data-handling policies

See [PLAYBOOK.md](./PLAYBOOK.md) for how to add the next internal application to this repository.
