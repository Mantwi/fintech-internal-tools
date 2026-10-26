import { authorize } from "@/lib/auth";
import { prisma, type Db } from "@/lib/db";

// Append-only audit trail. This module intentionally exposes no update or
// delete functions, and no API route modifies audit rows.

export type AuditValue = string | number | boolean | null | string[] | { from: string | null; to: string | null };
export type AuditChanges = Record<string, AuditValue>;

/** Keys that would indicate sensitive data leaking into the audit trail. */
const FORBIDDEN_CHANGE_KEYS = ["ssn", "dateOfBirth", "dob", "body", "note", "noteText"];

export interface AuditEventInput {
  actorId: string;
  action: string;
  resourceType: string;
  resourceId: string;
  changes?: AuditChanges;
}

/** Pass a transaction client to persist the event atomically with the business change. */
export async function recordAuditEvent(db: Db, input: AuditEventInput) {
  const leaked = Object.keys(input.changes ?? {}).filter((k) => FORBIDDEN_CHANGE_KEYS.includes(k));
  if (leaked.length > 0) {
    throw new Error(`Refusing to write sensitive fields to the audit log: ${leaked.join(", ")}`);
  }
  return db.auditEvent.create({
    data: {
      actorId: input.actorId,
      action: input.action,
      resourceType: input.resourceType,
      resourceId: input.resourceId,
      changes: input.changes ? JSON.stringify(input.changes) : null,
    },
  });
}

export interface AuditEventView {
  id: string;
  action: string;
  resourceType: string;
  resourceId: string;
  actor: { id: string; name: string; role: string };
  changes: AuditChanges | null;
  createdAt: string;
}

function toView(e: {
  id: string;
  action: string;
  resourceType: string;
  resourceId: string;
  changes: string | null;
  createdAt: Date;
  actor: { id: string; name: string; role: string };
}): AuditEventView {
  return {
    id: e.id,
    action: e.action,
    resourceType: e.resourceType,
    resourceId: e.resourceId,
    actor: e.actor,
    changes: e.changes ? (JSON.parse(e.changes) as AuditChanges) : null,
    createdAt: e.createdAt.toISOString(),
  };
}

const actorSelect = { select: { id: true, name: true, role: true } } as const;

/** History for one resource. Callers must authorize access to the resource first. */
export async function getResourceHistory(resourceType: string, resourceId: string): Promise<AuditEventView[]> {
  const events = await prisma.auditEvent.findMany({
    where: { resourceType, resourceId },
    include: { actor: actorSelect },
    orderBy: { createdAt: "desc" },
  });
  return events.map(toView);
}

/** Global audit log; restricted to roles with `audit:read`. */
export async function listAuditEvents(
  actorId: string | null | undefined,
  filters: { resourceId?: string; limit?: number } = {},
): Promise<AuditEventView[]> {
  await authorize(actorId, "audit:read");
  const events = await prisma.auditEvent.findMany({
    where: filters.resourceId ? { resourceId: filters.resourceId } : undefined,
    include: { actor: actorSelect },
    orderBy: { createdAt: "desc" },
    take: Math.min(filters.limit ?? 200, 500),
  });
  return events.map(toView);
}
