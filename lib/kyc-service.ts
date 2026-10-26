import type { KycCase } from "@prisma/client";
import { authorize, hasPermission, type Actor, type Permission } from "@/lib/auth";
import { getResourceHistory, recordAuditEvent, type AuditEventView } from "@/lib/audit";
import { prisma } from "@/lib/db";
import { AuthorizationError, BusinessRuleError, NotFoundError, ValidationError } from "@/lib/errors";
import { maskDateOfBirth, maskSsn } from "@/lib/masking";

// All KYC business rules live here. Every exported function takes the
// caller's actor ID, re-loads the actor from the database, and enforces
// authorization itself, so it is safe to call from any entry point.

export const CASE_STATUSES = ["PENDING", "IN_REVIEW", "APPROVED", "REJECTED", "ESCALATED"] as const;
export const RISK_LEVELS = ["LOW", "MEDIUM", "HIGH"] as const;
export type CaseStatus = (typeof CASE_STATUSES)[number];
export type RiskLevel = (typeof RISK_LEVELS)[number];

const FINAL_STATUSES: readonly string[] = ["APPROVED", "REJECTED"];
const RESOURCE_TYPE = "KycCase";
const NOTE_MAX_LENGTH = 2000;

export const AUDIT_ACTIONS = {
  claimed: "CASE_CLAIMED",
  approved: "CASE_APPROVED",
  rejected: "CASE_REJECTED",
  escalated: "CASE_ESCALATED",
  noteAdded: "NOTE_ADDED",
  piiViewed: "PII_UNMASKED_VIEW",
} as const;

export type CaseAction = "CLAIM" | "ADD_NOTE" | "ESCALATE" | "APPROVE" | "REJECT";

const ACTION_PERMISSION: Record<CaseAction, Permission> = {
  CLAIM: "kyc:claim",
  ADD_NOTE: "kyc:note",
  ESCALATE: "kyc:escalate",
  APPROVE: "kyc:decide",
  REJECT: "kyc:decide",
};

type RuleResult = { ok: true } | { ok: false; kind: "forbidden" | "conflict"; message: string };
const allow: RuleResult = { ok: true };
const forbid = (message: string): RuleResult => ({ ok: false, kind: "forbidden", message });
const conflict = (message: string): RuleResult => ({ ok: false, kind: "conflict", message });

type CaseState = Pick<KycCase, "status" | "riskLevel" | "assignedReviewerId" | "escalatedById">;

/**
 * The KYC workflow in one place:
 *   PENDING   --claim (analyst)-->                          IN_REVIEW
 *   IN_REVIEW --approve/reject (assigned analyst, LOW/MED)-> APPROVED | REJECTED
 *   IN_REVIEW --escalate (assigned analyst or lead)-->      ESCALATED
 *   ESCALATED --approve/reject (lead != escalator)-->       APPROVED | REJECTED
 * APPROVED and REJECTED are final.
 */
export function evaluateAction(actor: Actor, kycCase: CaseState, action: CaseAction): RuleResult {
  if (!hasPermission(actor.role, ACTION_PERMISSION[action])) {
    return forbid(`Role ${actor.role} cannot perform ${action}`);
  }
  if (FINAL_STATUSES.includes(kycCase.status)) {
    return conflict(`Case is ${kycCase.status}; final cases cannot be changed`);
  }

  switch (action) {
    case "CLAIM":
      if (kycCase.status !== "PENDING") return conflict(`Only PENDING cases can be claimed (case is ${kycCase.status})`);
      return allow;

    case "ADD_NOTE":
      return allow;

    case "ESCALATE":
      if (kycCase.status !== "IN_REVIEW") return conflict(`Only IN_REVIEW cases can be escalated (case is ${kycCase.status})`);
      if (actor.role === "ANALYST" && kycCase.assignedReviewerId !== actor.id) {
        return forbid("Only the assigned analyst can escalate this case");
      }
      return allow;

    case "APPROVE":
    case "REJECT": {
      const verb = action === "APPROVE" ? "approve" : "reject";
      if (actor.role === "ANALYST") {
        if (kycCase.riskLevel === "HIGH") {
          return forbid(`Analysts cannot ${verb} HIGH-risk cases; escalate to a compliance lead`);
        }
        if (kycCase.status === "ESCALATED") return forbid("Escalated cases require a compliance lead decision");
        if (kycCase.status !== "IN_REVIEW") return conflict(`Case must be IN_REVIEW to ${verb} (case is ${kycCase.status})`);
        if (kycCase.assignedReviewerId !== actor.id) return forbid(`Only the assigned analyst can ${verb} this case`);
        return allow;
      }
      // COMPLIANCE_LEAD
      if (kycCase.status !== "ESCALATED") {
        return conflict(
          kycCase.riskLevel === "HIGH"
            ? `HIGH-risk cases must be escalated before a final decision (case is ${kycCase.status})`
            : `Compliance leads decide escalated cases only (case is ${kycCase.status})`,
        );
      }
      if (kycCase.escalatedById === actor.id) {
        return forbid(`Separation of duties: you escalated this case, so another compliance lead must ${verb} it`);
      }
      return allow;
    }
  }
}

function assertAllowed(actor: Actor, kycCase: CaseState, action: CaseAction) {
  const result = evaluateAction(actor, kycCase, action);
  if (result.ok) return;
  throw result.kind === "forbidden" ? new AuthorizationError(result.message) : new BusinessRuleError(result.message);
}

// ---------- Read models ----------

export interface CaseSummary {
  id: string;
  customerName: string;
  riskLevel: string;
  status: string;
  assignedReviewer: { id: string; name: string } | null;
  createdAt: string;
  updatedAt: string;
}

export interface CaseDetail extends CaseSummary {
  dateOfBirth: string;
  ssn: string;
  piiMasked: boolean;
  documentType: string;
  escalatedBy: { id: string; name: string } | null;
  notes: { id: string; body: string; author: { id: string; name: string }; createdAt: string }[];
  history: AuditEventView[];
  allowedActions: CaseAction[];
  canRevealPii: boolean;
}

export interface CaseFilters {
  q?: string;
  status?: string;
  risk?: string;
}

const personSelect = { select: { id: true, name: true } } as const;

function toSummary(c: KycCase & { assignedReviewer: { id: string; name: string } | null }): CaseSummary {
  return {
    id: c.id,
    customerName: c.customerName,
    riskLevel: c.riskLevel,
    status: c.status,
    assignedReviewer: c.assignedReviewer,
    createdAt: c.createdAt.toISOString(),
    updatedAt: c.updatedAt.toISOString(),
  };
}

export async function listCases(actorId: string | null | undefined, filters: CaseFilters = {}): Promise<CaseSummary[]> {
  await authorize(actorId, "kyc:read");

  if (filters.status && !(CASE_STATUSES as readonly string[]).includes(filters.status)) {
    throw new ValidationError("Unknown status filter");
  }
  if (filters.risk && !(RISK_LEVELS as readonly string[]).includes(filters.risk)) {
    throw new ValidationError("Unknown risk filter");
  }
  const q = filters.q?.trim();

  const cases = await prisma.kycCase.findMany({
    where: {
      ...(q ? { customerName: { contains: q } } : {}), // SQLite LIKE: case-insensitive for ASCII
      ...(filters.status ? { status: filters.status } : {}),
      ...(filters.risk ? { riskLevel: filters.risk } : {}),
    },
    include: { assignedReviewer: personSelect },
    orderBy: { createdAt: "desc" },
  });
  return cases.map(toSummary);
}

/**
 * Returns a case with SSN/DOB masked. With `revealPii`, requires `pii:unmask`
 * and records an audit event *before* the unmasked values are returned.
 */
export async function getCase(
  actorId: string | null | undefined,
  caseId: string,
  options: { revealPii?: boolean } = {},
): Promise<CaseDetail> {
  const actor = await authorize(actorId, options.revealPii ? "pii:unmask" : "kyc:read");

  const c = await prisma.kycCase.findUnique({
    where: { id: caseId },
    include: {
      assignedReviewer: personSelect,
      escalatedBy: personSelect,
      notes: { include: { author: personSelect }, orderBy: { createdAt: "desc" } },
    },
  });
  if (!c) throw new NotFoundError("Case not found");

  if (options.revealPii) {
    await recordAuditEvent(prisma, {
      actorId: actor.id,
      action: AUDIT_ACTIONS.piiViewed,
      resourceType: RESOURCE_TYPE,
      resourceId: c.id,
      changes: { fields: ["ssn", "dateOfBirth"] },
    });
  }

  const allActions: CaseAction[] = ["CLAIM", "ADD_NOTE", "ESCALATE", "APPROVE", "REJECT"];

  return {
    ...toSummary(c),
    ssn: options.revealPii ? c.ssn : maskSsn(c.ssn),
    dateOfBirth: options.revealPii ? c.dateOfBirth : maskDateOfBirth(),
    piiMasked: !options.revealPii,
    documentType: c.documentType,
    escalatedBy: c.escalatedBy,
    notes: c.notes.map((n) => ({ id: n.id, body: n.body, author: n.author, createdAt: n.createdAt.toISOString() })),
    history: await getResourceHistory(RESOURCE_TYPE, c.id),
    allowedActions: allActions.filter((a) => evaluateAction(actor, c, a).ok),
    canRevealPii: hasPermission(actor.role, "pii:unmask"),
  };
}

// ---------- Commands ----------

async function loadForAction(actorId: string | null | undefined, caseId: string, action: CaseAction) {
  const actor = await authorize(actorId, ACTION_PERMISSION[action]);
  const kycCase = await prisma.kycCase.findUnique({ where: { id: caseId } });
  if (!kycCase) throw new NotFoundError("Case not found");
  assertAllowed(actor, kycCase, action);
  return { actor, kycCase };
}

/**
 * Applies a status change and its audit event in one transaction. The update
 * is conditional on the status we validated against, so a concurrent change
 * makes this fail instead of silently overwriting it.
 */
async function changeStatus(
  actor: Actor,
  kycCase: KycCase,
  data: { status: CaseStatus; assignedReviewerId?: string; escalatedById?: string },
  auditAction: string,
) {
  return prisma.$transaction(async (tx) => {
    const result = await tx.kycCase.updateMany({ where: { id: kycCase.id, status: kycCase.status }, data });
    if (result.count !== 1) throw new BusinessRuleError("Case changed while you were working on it; reload and retry");

    const changes: Record<string, { from: string | null; to: string | null }> = {
      status: { from: kycCase.status, to: data.status },
    };
    if (data.assignedReviewerId !== undefined) {
      changes.assignedReviewerId = { from: kycCase.assignedReviewerId, to: data.assignedReviewerId };
    }
    if (data.escalatedById !== undefined) {
      changes.escalatedById = { from: kycCase.escalatedById, to: data.escalatedById };
    }
    await recordAuditEvent(tx, {
      actorId: actor.id,
      action: auditAction,
      resourceType: RESOURCE_TYPE,
      resourceId: kycCase.id,
      changes,
    });
    return { id: kycCase.id, status: data.status };
  });
}

export async function claimCase(actorId: string | null | undefined, caseId: string) {
  const { actor, kycCase } = await loadForAction(actorId, caseId, "CLAIM");
  return changeStatus(actor, kycCase, { status: "IN_REVIEW", assignedReviewerId: actor.id }, AUDIT_ACTIONS.claimed);
}

export async function escalateCase(actorId: string | null | undefined, caseId: string) {
  const { actor, kycCase } = await loadForAction(actorId, caseId, "ESCALATE");
  return changeStatus(actor, kycCase, { status: "ESCALATED", escalatedById: actor.id }, AUDIT_ACTIONS.escalated);
}

export async function approveCase(actorId: string | null | undefined, caseId: string) {
  const { actor, kycCase } = await loadForAction(actorId, caseId, "APPROVE");
  return changeStatus(actor, kycCase, { status: "APPROVED" }, AUDIT_ACTIONS.approved);
}

export async function rejectCase(actorId: string | null | undefined, caseId: string) {
  const { actor, kycCase } = await loadForAction(actorId, caseId, "REJECT");
  return changeStatus(actor, kycCase, { status: "REJECTED" }, AUDIT_ACTIONS.rejected);
}

/** Adds a reviewer note. The audit event stores the note ID only, never the text. */
export async function addNote(actorId: string | null | undefined, caseId: string, body: string) {
  const text = body.trim();
  if (!text) throw new ValidationError("Note cannot be empty");
  if (text.length > NOTE_MAX_LENGTH) throw new ValidationError(`Note cannot exceed ${NOTE_MAX_LENGTH} characters`);

  const { actor, kycCase } = await loadForAction(actorId, caseId, "ADD_NOTE");

  return prisma.$transaction(async (tx) => {
    const note = await tx.reviewNote.create({ data: { caseId: kycCase.id, authorId: actor.id, body: text } });
    await tx.kycCase.update({ where: { id: kycCase.id }, data: { updatedAt: new Date() } });
    await recordAuditEvent(tx, {
      actorId: actor.id,
      action: AUDIT_ACTIONS.noteAdded,
      resourceType: RESOURCE_TYPE,
      resourceId: kycCase.id,
      changes: { noteId: note.id, authorId: actor.id },
    });
    return { id: note.id, caseId: kycCase.id };
  });
}
