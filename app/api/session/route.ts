import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { errorResponse, getDemoUserId, handle, readJson } from "@/lib/api";
import { DEMO_USER_COOKIE, resolveActor } from "@/lib/auth";

// DEMO ONLY: selects a simulated identity. This is not authentication.

export async function GET(req: NextRequest) {
  return handle(async () => ({ user: await resolveActor(getDemoUserId(req)) }));
}

const bodySchema = z.object({ userId: z.string().min(1) });

export async function POST(req: NextRequest) {
  try {
    const { userId } = bodySchema.parse(await readJson(req));
    const user = await resolveActor(userId);
    const res = NextResponse.json({ user });
    res.cookies.set(DEMO_USER_COOKIE, user.id, { httpOnly: true, sameSite: "lax", path: "/" });
    return res;
  } catch (error) {
    return errorResponse(error);
  }
}

export async function DELETE() {
  const res = NextResponse.json({ ok: true });
  res.cookies.delete(DEMO_USER_COOKIE);
  return res;
}
