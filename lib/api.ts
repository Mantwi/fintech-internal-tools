import { NextResponse, type NextRequest } from "next/server";
import { ZodError } from "zod";
import { DEMO_USER_COOKIE } from "@/lib/auth";
import { AppError } from "@/lib/errors";

// Helpers that keep route handlers thin: read the demo identity, run a
// service call, and map errors to JSON responses.

export function getDemoUserId(req: NextRequest): string | null {
  return req.cookies.get(DEMO_USER_COOKIE)?.value ?? null;
}

export function errorResponse(error: unknown) {
  if (error instanceof AppError) {
    return NextResponse.json({ error: { code: error.code, message: error.message } }, { status: error.status });
  }
  if (error instanceof ZodError) {
    const message = error.issues.map((i) => `${i.path.join(".") || "body"}: ${i.message}`).join("; ");
    return NextResponse.json({ error: { code: "INVALID_REQUEST", message } }, { status: 400 });
  }
  // Log only the error type: unexpected errors may embed query data.
  console.error("Unhandled API error:", error instanceof Error ? error.name : typeof error);
  return NextResponse.json({ error: { code: "INTERNAL", message: "Internal server error" } }, { status: 500 });
}

export async function handle(fn: () => Promise<unknown>, successStatus = 200) {
  try {
    return NextResponse.json(await fn(), { status: successStatus });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function readJson(req: NextRequest): Promise<unknown> {
  try {
    return await req.json();
  } catch {
    return {};
  }
}
