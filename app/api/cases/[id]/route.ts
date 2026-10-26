import type { NextRequest } from "next/server";
import { getDemoUserId, handle } from "@/lib/api";
import { getCase } from "@/lib/kyc-service";

type Context = { params: Promise<{ id: string }> };

/** GET /api/cases/:id[?reveal=1] — reveal requires pii:unmask and is audited. */
export async function GET(req: NextRequest, { params }: Context) {
  return handle(async () => {
    const { id } = await params;
    const revealPii = req.nextUrl.searchParams.get("reveal") === "1";
    return { case: await getCase(getDemoUserId(req), id, { revealPii }) };
  });
}
