import type { NextRequest } from "next/server";
import { getDemoUserId, handle } from "@/lib/api";
import { listAuditEvents } from "@/lib/audit";

/** GET /api/audit[?caseId=KYC-1001] — COMPLIANCE_LEAD and ADMIN only. Read-only by design. */
export async function GET(req: NextRequest) {
  return handle(async () => {
    const resourceId = req.nextUrl.searchParams.get("caseId") ?? undefined;
    return { events: await listAuditEvents(getDemoUserId(req), { resourceId }) };
  });
}
