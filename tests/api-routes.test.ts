import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it } from "vitest";
import { GET as getAudit } from "@/app/api/audit/route";
import { POST as postAction } from "@/app/api/cases/[id]/actions/route";
import { GET as getCaseRoute } from "@/app/api/cases/[id]/route";
import { prisma } from "@/lib/db";
import { USERS, resetDatabase } from "./helpers";

// Exercises the real route handlers to prove they invoke authorization,
// rather than relying on the UI to hide controls.

beforeEach(resetDatabase);

function request(url: string, userId?: string, init: { method?: string; body?: unknown } = {}) {
  return new NextRequest(`http://localhost${url}`, {
    method: init.method ?? "GET",
    headers: {
      ...(userId ? { cookie: `demo_user_id=${userId}` } : {}),
      ...(init.body ? { "content-type": "application/json" } : {}),
    },
    body: init.body ? JSON.stringify(init.body) : undefined,
  });
}

const params = (id: string) => ({ params: Promise.resolve({ id }) });

describe("protected API routes", () => {
  it("GET /api/audit rejects an ANALYST with 403 and allows a COMPLIANCE_LEAD", async () => {
    const denied = await getAudit(request("/api/audit", USERS.analystAlex));
    expect(denied.status).toBe(403);
    expect((await denied.json()).error.code).toBe("FORBIDDEN");

    const allowed = await getAudit(request("/api/audit", USERS.leadMorgan));
    expect(allowed.status).toBe(200);
  });

  it("GET /api/audit rejects requests with no demo identity (401)", async () => {
    const res = await getAudit(request("/api/audit"));
    expect(res.status).toBe(401);
  });

  it("GET /api/cases/:id?reveal=1 rejects an ANALYST without leaking the SSN", async () => {
    const res = await getCaseRoute(request("/api/cases/KYC-1004?reveal=1", USERS.analystAlex), params("KYC-1004"));
    expect(res.status).toBe(403);
    const text = await res.text();
    expect(text).not.toContain("900-14-1004");
    expect(text).not.toContain("1968-01-30");
  });

  it("GET /api/cases/:id returns masked PII for an ANALYST", async () => {
    const res = await getCaseRoute(request("/api/cases/KYC-1004", USERS.analystAlex), params("KYC-1004"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.case.ssn).toBe("***-**-1004");
    expect(JSON.stringify(body)).not.toContain("900-14-1004");
  });

  it("POST /api/cases/:id/actions rejects an ANALYST approving a HIGH-risk case", async () => {
    const res = await postAction(
      request("/api/cases/KYC-1006/actions", USERS.analystAlex, { method: "POST", body: { action: "approve" } }),
      params("KYC-1006"),
    );
    expect(res.status).toBe(403);
    expect((await prisma.kycCase.findUnique({ where: { id: "KYC-1006" } }))!.status).toBe("IN_REVIEW");
  });

  it("POST /api/cases/:id/actions validates the request body", async () => {
    const res = await postAction(
      request("/api/cases/KYC-1001/actions", USERS.analystAlex, { method: "POST", body: { action: "delete" } }),
      params("KYC-1001"),
    );
    expect(res.status).toBe(400);
  });
});
