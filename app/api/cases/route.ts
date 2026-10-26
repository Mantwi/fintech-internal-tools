import type { NextRequest } from "next/server";
import { z } from "zod";
import { getDemoUserId, handle } from "@/lib/api";
import { listCases } from "@/lib/kyc-service";

const querySchema = z.object({
  q: z.string().max(100).optional(),
  status: z.string().optional(),
  risk: z.string().optional(),
});

export async function GET(req: NextRequest) {
  return handle(async () => {
    const filters = querySchema.parse(Object.fromEntries(req.nextUrl.searchParams));
    return { cases: await listCases(getDemoUserId(req), filters) };
  });
}
