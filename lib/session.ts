import { cookies } from "next/headers";
import { DEMO_USER_COOKIE } from "@/lib/auth";

/** Demo identity for server components (route handlers use lib/api.ts). */
export async function getDemoUserIdFromCookies(): Promise<string | null> {
  return (await cookies()).get(DEMO_USER_COOKIE)?.value ?? null;
}
