# Playbook: Adding Another Internal App

This guide shows how to add a new internal tool (e.g. a refunds dashboard) to this repo, using the KYC review queue as the reference. Follow the same pattern: **schema → service → thin routes → pages → tests**.

The examples below use a hypothetical `Refund` model. Rename to suit.

## 1. Add a database model

Edit `prisma/schema.prisma`. Store statuses as strings (SQLite has no enums) and validate them in the service.

```prisma
model Refund {
  id          String   @id
  customerRef String
  amountCents Int
  status      String   @default("REQUESTED") // REQUESTED | APPROVED | DENIED
  requestedById String
  requestedBy User     @relation("RefundRequester", fields: [requestedById], references: [id])
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
}
```

Add the back-relation on `User` (`refundsRequested Refund[] @relation("RefundRequester")`), then:

```bash
npx prisma migrate dev --name add_refunds   # creates prisma/migrations/<ts>_add_refunds
```

Add synthetic rows to `prisma/seed-data.ts` (and its `deleteMany` list) so `npm run db:seed` and the tests have data. **Use synthetic data only.**

## 2. Add permissions and a service

1. Add permissions to the map in `lib/auth.ts`:

   ```ts
   "refund:read": ["ANALYST", "COMPLIANCE_LEAD", "ADMIN"],
   "refund:decide": ["COMPLIANCE_LEAD"],
   ```

   Add a role to `ROLES` only if the new app truly needs one.

2. Create `lib/refund-service.ts`, modeled on `lib/kyc-service.ts`:

   - Every exported function takes `actorId` first and begins with `const actor = await authorize(actorId, "refund:...")`. Never accept a role from the caller.
   - Put state-dependent rules (e.g. "requester cannot approve own refund", amount limits) in one `evaluateAction(actor, record, action)` function. Use it both to enforce actions and to return `allowedActions` to the UI.
   - Throw `AuthorizationError` (403) for "not allowed for you", `BusinessRuleError` (409) for "not allowed in this state", `ValidationError` (400), `NotFoundError` (404) from `lib/errors.ts`. **Never put sensitive values in error messages.**
   - Mask sensitive fields in the service before returning them (see `lib/masking.ts`).

## 3. Record audit events

Use `recordAuditEvent` from `lib/audit.ts` inside the same transaction as the change:

```ts
return prisma.$transaction(async (tx) => {
  const res = await tx.refund.updateMany({ where: { id, status: refund.status }, data: { status: "APPROVED" } });
  if (res.count !== 1) throw new BusinessRuleError("Refund changed; reload and retry");
  await recordAuditEvent(tx, {
    actorId: actor.id,
    action: "REFUND_APPROVED",
    resourceType: "Refund",
    resourceId: id,
    changes: { status: { from: refund.status, to: "APPROVED" } },
  });
});
```

Rules:
- Store only non-sensitive before/after values or IDs (e.g. `noteId`, never note text). `recordAuditEvent` rejects keys like `ssn`, `dateOfBirth`, and `body`. Extend `FORBIDDEN_CHANGE_KEYS` if your app has other sensitive fields.
- For reads of unmasked sensitive data, write the audit event **before** returning the data (see `getCase` with `revealPii`).
- Do not add routes that update or delete audit events. The existing `/audit` page lists events from every app automatically, and `getResourceHistory("Refund", id)` gives per-record history.

## 4. Add routes

API routes go in `app/api/refunds/...`. Keep them thin, as in `app/api/cases/[id]/actions/route.ts`:

```ts
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const { id } = await params;
    const { action } = bodySchema.parse(await readJson(req));   // zod validation
    return handlers[action](getDemoUserId(req), id);             // service does authz + rules
  });
}
```

`handle()` in `lib/api.ts` converts `AppError`s and Zod errors into JSON responses with the right status codes.

Pages go in `app/refunds/page.tsx` and `app/refunds/[id]/page.tsx`. Server components call the service directly with `await getDemoUserIdFromCookies()` and render `<ErrorState error={error} />` on failure (see `app/kyc/page.tsx`). Client components that mutate data call the API with `apiRequest()` from `lib/client-api.ts`, then `router.refresh()`.

Add a link to `LINKS` in `components/MainNav.tsx`.

## 5. Reuse UI components

| Need | Use |
| --- | --- |
| List/table with links to details | `components/ui/DataTable.tsx` (`columns`, `rows`, `rowHref`) |
| Status / risk pills | `components/ui/Badge.tsx`, plus a small value→tone map like `app/kyc/_components/badges.tsx` |
| Page title + actions | `components/ui/PageHeader.tsx` |
| Panels | `components/ui/Card.tsx` |
| 401/403/404 display | `components/ui/ErrorState.tsx` |
| Filter forms | GET `<form className="filters">` with `.input`/`.select`/`.btn` classes (see the KYC queue) |
| Action buttons with server errors | Copy the pattern in `app/kyc/[id]/CaseActions.tsx` |

Styles live in `app/globals.css`. Add classes there rather than introducing a CSS framework.

## 6. Add tests

Create `tests/refund-service.test.ts`:

```ts
import { beforeEach, expect, it } from "vitest";
import { USERS, resetDatabase } from "./helpers";
beforeEach(resetDatabase);

it("requester cannot approve their own refund", async () => {
  await expect(approveRefund(USERS.leadMorgan, "RF-1")).rejects.toBeInstanceOf(AuthorizationError);
});
```

At minimum, cover:
- each role's allowed and denied actions (call the service with different `USERS`)
- invalid state transitions
- that each mutation writes exactly one audit event, with no sensitive values (see test 12 in `tests/kyc-service.test.ts`)
- one route-level test that calls the real handler with a `NextRequest` and a `demo_user_id` cookie and expects 403 (see `tests/api-routes.test.ts`)

Run `npm test && npm run lint && npm run typecheck` before opening a PR.

## Checklist

- [ ] Model + migration + synthetic seed rows
- [ ] Permissions added to `lib/auth.ts`
- [ ] Service with `authorize()` first in every function, plus one rule evaluator
- [ ] Mutations + audit events in one transaction; no sensitive values in audit/errors/logs
- [ ] Thin routes using `handle()` + zod
- [ ] Pages built from `components/ui/*`, nav link added
- [ ] Service tests + one route-level authorization test
- [ ] README updated (roles, walkthrough, limitations)
