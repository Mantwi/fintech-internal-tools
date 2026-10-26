import type { NextRequest } from "next/server";
import { z } from "zod";
import { getDemoUserId, handle, readJson } from "@/lib/api";
import { approveCase, claimCase, escalateCase, rejectCase } from "@/lib/kyc-service";

type Context = { params: Promise<{ id: string }> };

const bodySchema = z.object({ action: z.enum(["claim", "approve", "reject", "escalate"]) });

const handlers = { claim: claimCase, approve: approveCase, reject: rejectCase, escalate: escalateCase };

/** POST /api/cases/:id/actions { action: "claim" | "approve" | "reject" | "escalate" } */
export async function POST(req: NextRequest, { params }: Context) {
  return handle(async () => {
    const { id } = await params;
    const { action } = bodySchema.parse(await readJson(req));
    return handlers[action](getDemoUserId(req), id);
  });
}
