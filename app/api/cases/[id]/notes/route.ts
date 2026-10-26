import type { NextRequest } from "next/server";
import { z } from "zod";
import { getDemoUserId, handle, readJson } from "@/lib/api";
import { addNote } from "@/lib/kyc-service";

type Context = { params: Promise<{ id: string }> };

const bodySchema = z.object({ body: z.string() });

export async function POST(req: NextRequest, { params }: Context) {
  return handle(async () => {
    const { id } = await params;
    const { body } = bodySchema.parse(await readJson(req));
    return addNote(getDemoUserId(req), id, body);
  }, 201);
}
