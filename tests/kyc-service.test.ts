import { beforeEach, describe, expect, it } from "vitest";
import { listAuditEvents } from "@/lib/audit";
import { prisma } from "@/lib/db";
import { AuthenticationError, AuthorizationError, BusinessRuleError } from "@/lib/errors";
import {
  AUDIT_ACTIONS,
  addNote,
  approveCase,
  claimCase,
  escalateCase,
  getCase,
  listCases,
  rejectCase,
} from "@/lib/kyc-service";
import { DEMO_CASES } from "@/prisma/seed-data";
import { USERS, auditEventsFor, resetDatabase } from "./helpers";

beforeEach(resetDatabase);

const raw = (id: string) => DEMO_CASES.find((c) => c.id === id)!;

describe("sensitive-data masking", () => {
  it("1. ANALYST receives masked SSN and DOB", async () => {
    const c = await getCase(USERS.analystAlex, "KYC-1004");
    expect(c.ssn).toBe("***-**-1004");
    expect(c.dateOfBirth).toBe("****-**-**");
    expect(c.piiMasked).toBe(true);
    expect(JSON.stringify(c)).not.toContain(raw("KYC-1004").ssn);
    expect(JSON.stringify(c)).not.toContain(raw("KYC-1004").dateOfBirth);
  });

  it("2. ADMIN also receives masked SSN and DOB and cannot unmask", async () => {
    const c = await getCase(USERS.admin, "KYC-1004");
    expect(c.ssn).toBe("***-**-1004");
    expect(c.dateOfBirth).toBe("****-**-**");
    await expect(getCase(USERS.admin, "KYC-1004", { revealPii: true })).rejects.toBeInstanceOf(AuthorizationError);
    await expect(getCase(USERS.analystAlex, "KYC-1004", { revealPii: true })).rejects.toBeInstanceOf(AuthorizationError);
  });

  it("COMPLIANCE_LEAD gets masked values by default and unmasked values on explicit reveal", async () => {
    expect((await getCase(USERS.leadMorgan, "KYC-1004")).ssn).toBe("***-**-1004");
    const revealed = await getCase(USERS.leadMorgan, "KYC-1004", { revealPii: true });
    expect(revealed.ssn).toBe(raw("KYC-1004").ssn);
    expect(revealed.dateOfBirth).toBe(raw("KYC-1004").dateOfBirth);
    expect(revealed.piiMasked).toBe(false);
  });
});

describe("high-risk approval rules", () => {
  it("3. ANALYST cannot approve a HIGH-risk case, even when assigned", async () => {
    await expect(approveCase(USERS.analystAlex, "KYC-1006")).rejects.toBeInstanceOf(AuthorizationError);
    await expect(rejectCase(USERS.analystAlex, "KYC-1006")).rejects.toBeInstanceOf(AuthorizationError);
    expect((await prisma.kycCase.findUnique({ where: { id: "KYC-1006" } }))!.status).toBe("IN_REVIEW");
  });

  it("4. HIGH-risk case cannot be approved by anyone without escalation", async () => {
    await expect(approveCase(USERS.leadMorgan, "KYC-1006")).rejects.toBeInstanceOf(BusinessRuleError);
    await expect(approveCase(USERS.leadSam, "KYC-1018")).rejects.toThrow(/must be escalated/);
    await expect(approveCase(USERS.admin, "KYC-1006")).rejects.toBeInstanceOf(AuthorizationError);
  });

  it("5. the user who escalated a case cannot approve or reject it", async () => {
    await escalateCase(USERS.leadMorgan, "KYC-1018");
    await expect(approveCase(USERS.leadMorgan, "KYC-1018")).rejects.toThrow(/Separation of duties/);
    await expect(rejectCase(USERS.leadMorgan, "KYC-1018")).rejects.toBeInstanceOf(AuthorizationError);
    // Seeded case escalated by Morgan
    await expect(approveCase(USERS.leadMorgan, "KYC-1008")).rejects.toBeInstanceOf(AuthorizationError);
  });

  it("6. a different COMPLIANCE_LEAD can approve an escalated case", async () => {
    await escalateCase(USERS.analystAlex, "KYC-1006");
    const result = await approveCase(USERS.leadSam, "KYC-1006");
    expect(result.status).toBe("APPROVED");
    expect((await prisma.kycCase.findUnique({ where: { id: "KYC-1006" } }))!.status).toBe("APPROVED");
  });

  it("7. a different COMPLIANCE_LEAD can reject an escalated case", async () => {
    await escalateCase(USERS.leadMorgan, "KYC-1018");
    const result = await rejectCase(USERS.leadSam, "KYC-1018");
    expect(result.status).toBe("REJECTED");
  });

  it("only a COMPLIANCE_LEAD may decide an ESCALATED case", async () => {
    await expect(approveCase(USERS.analystAlex, "KYC-1017")).rejects.toBeInstanceOf(AuthorizationError);
    await expect(approveCase(USERS.admin, "KYC-1017")).rejects.toBeInstanceOf(AuthorizationError);
    await expect(approveCase(USERS.leadMorgan, "KYC-1017")).resolves.toMatchObject({ status: "APPROVED" });
  });
});

describe("workflow and final states", () => {
  it("analyst claims a PENDING case, then approves a LOW/MEDIUM case", async () => {
    await claimCase(USERS.analystJordan, "KYC-1001");
    const claimed = await prisma.kycCase.findUnique({ where: { id: "KYC-1001" } });
    expect(claimed).toMatchObject({ status: "IN_REVIEW", assignedReviewerId: USERS.analystJordan });
    await expect(approveCase(USERS.analystAlex, "KYC-1001")).rejects.toThrow(/assigned analyst/);
    await expect(approveCase(USERS.analystJordan, "KYC-1001")).resolves.toMatchObject({ status: "APPROVED" });
  });

  it("only analysts can claim, and only PENDING cases", async () => {
    await expect(claimCase(USERS.leadMorgan, "KYC-1001")).rejects.toBeInstanceOf(AuthorizationError);
    await expect(claimCase(USERS.admin, "KYC-1001")).rejects.toBeInstanceOf(AuthorizationError);
    await expect(claimCase(USERS.analystAlex, "KYC-1005")).rejects.toBeInstanceOf(BusinessRuleError);
  });

  it("8. APPROVED and REJECTED cases reject further transitions", async () => {
    for (const id of ["KYC-1009", "KYC-1010"]) {
      await expect(claimCase(USERS.analystAlex, id)).rejects.toThrow(/final/);
      await expect(escalateCase(USERS.leadMorgan, id)).rejects.toThrow(/final/);
      await expect(approveCase(USERS.leadSam, id)).rejects.toThrow(/final/);
      await expect(rejectCase(USERS.leadSam, id)).rejects.toThrow(/final/);
      await expect(addNote(USERS.leadSam, id, "late note")).rejects.toThrow(/final/);
    }
    expect((await prisma.kycCase.findUnique({ where: { id: "KYC-1009" } }))!.status).toBe("APPROVED");
    expect((await prisma.kycCase.findUnique({ where: { id: "KYC-1010" } }))!.status).toBe("REJECTED");
  });

  it("rejects requests without a valid demo identity", async () => {
    await expect(listCases(null)).rejects.toBeInstanceOf(AuthenticationError);
    await expect(approveCase("user_nobody", "KYC-1004")).rejects.toBeInstanceOf(AuthenticationError);
  });

  it("filters the queue by name, status, and risk", async () => {
    expect((await listCases(USERS.analystAlex, { q: "harper" })).map((c) => c.id)).toEqual(["KYC-1001"]);
    const highPending = await listCases(USERS.analystAlex, { status: "PENDING", risk: "HIGH" });
    expect(highPending.map((c) => c.id).sort()).toEqual(["KYC-1003", "KYC-1014"]);
  });
});

describe("audit logging", () => {
  it("9. a status change creates an audit event in the same transaction", async () => {
    await claimCase(USERS.analystAlex, "KYC-1002");
    const events = await auditEventsFor("KYC-1002");
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({ actorId: USERS.analystAlex, action: AUDIT_ACTIONS.claimed, resourceType: "KycCase" });
    expect(JSON.parse(events[0].changes!)).toEqual({
      status: { from: "PENDING", to: "IN_REVIEW" },
      assignedReviewerId: { from: null, to: USERS.analystAlex },
    });
  });

  it("failed actions do not create audit events", async () => {
    await expect(approveCase(USERS.analystAlex, "KYC-1006")).rejects.toThrow();
    expect(await auditEventsFor("KYC-1006")).toHaveLength(0);
  });

  it("10. an unmasked PII view creates an audit event; masked views do not", async () => {
    await getCase(USERS.leadSam, "KYC-1003");
    expect(await auditEventsFor("KYC-1003")).toHaveLength(0);
    await getCase(USERS.leadSam, "KYC-1003", { revealPii: true });
    const events = await auditEventsFor("KYC-1003");
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({ actorId: USERS.leadSam, action: AUDIT_ACTIONS.piiViewed });
  });

  it("11. adding a note creates an audit event without the note text", async () => {
    const text = "Customer mentioned SSN 900-99-0000 on the call — confidential";
    const note = await addNote(USERS.analystAlex, "KYC-1004", text);
    const events = await auditEventsFor("KYC-1004");
    expect(events).toHaveLength(1);
    expect(events[0].action).toBe(AUDIT_ACTIONS.noteAdded);
    expect(JSON.parse(events[0].changes!)).toEqual({ noteId: note.id, authorId: USERS.analystAlex });
    expect(JSON.stringify(events[0])).not.toContain("confidential");
    expect(JSON.stringify(events[0])).not.toContain("900-99-0000");
  });

  it("12. audit payloads never contain raw SSNs or dates of birth", async () => {
    await getCase(USERS.leadMorgan, "KYC-1006", { revealPii: true });
    await addNote(USERS.analystAlex, "KYC-1006", "Checked address history");
    await escalateCase(USERS.analystAlex, "KYC-1006");
    await approveCase(USERS.leadSam, "KYC-1006");
    await claimCase(USERS.analystJordan, "KYC-1013");
    await rejectCase(USERS.analystJordan, "KYC-1013");

    const all = await prisma.auditEvent.findMany();
    expect(all.length).toBe(6);
    const dump = JSON.stringify(all);
    for (const c of DEMO_CASES) {
      expect(dump).not.toContain(c.ssn);
      expect(dump).not.toContain(c.ssn.replace(/-/g, ""));
      expect(dump).not.toContain(c.dateOfBirth);
    }
  });

  it("audit history is limited to COMPLIANCE_LEAD and ADMIN", async () => {
    await claimCase(USERS.analystAlex, "KYC-1002");
    await expect(listAuditEvents(USERS.analystAlex)).rejects.toBeInstanceOf(AuthorizationError);
    expect(await listAuditEvents(USERS.leadMorgan)).toHaveLength(1);
    expect(await listAuditEvents(USERS.admin)).toHaveLength(1);
  });
});
