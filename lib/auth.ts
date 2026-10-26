import { prisma } from "@/lib/db";
import { AuthenticationError, AuthorizationError } from "@/lib/errors";

// DEMO ONLY: the selected identity comes from a cookie the user can change
// freely. It does not verify who the person is. Production needs real SSO.
export const DEMO_USER_COOKIE = "demo_user_id";

export const ROLES = ["ANALYST", "COMPLIANCE_LEAD", "ADMIN"] as const;
export type Role = (typeof ROLES)[number];

export interface Actor {
  id: string;
  name: string;
  role: Role;
}

/** Coarse role -> permission map. Case-level rules live in the domain service. */
const PERMISSIONS = {
  "kyc:read": ["ANALYST", "COMPLIANCE_LEAD", "ADMIN"],
  "kyc:claim": ["ANALYST"],
  "kyc:note": ["ANALYST", "COMPLIANCE_LEAD"],
  "kyc:escalate": ["ANALYST", "COMPLIANCE_LEAD"],
  "kyc:decide": ["ANALYST", "COMPLIANCE_LEAD"],
  "pii:unmask": ["COMPLIANCE_LEAD"],
  "audit:read": ["COMPLIANCE_LEAD", "ADMIN"],
} as const satisfies Record<string, readonly Role[]>;

export type Permission = keyof typeof PERMISSIONS;

const isRole = (value: string): value is Role => (ROLES as readonly string[]).includes(value);

export function hasPermission(role: Role, permission: Permission): boolean {
  return (PERMISSIONS[permission] as readonly Role[]).includes(role);
}

/** Loads the actor from the database; the role is never taken from the client. */
export async function resolveActor(actorId: string | null | undefined): Promise<Actor> {
  if (!actorId) throw new AuthenticationError();
  const user = await prisma.user.findUnique({ where: { id: actorId } });
  if (!user || !isRole(user.role)) throw new AuthenticationError("Unknown demo identity");
  return { id: user.id, name: user.name, role: user.role };
}

/**
 * Central authorization check. Resolves the actor server-side and throws
 * AuthorizationError unless their role grants `permission`.
 */
export async function authorize(actorId: string | null | undefined, permission: Permission): Promise<Actor> {
  const actor = await resolveActor(actorId);
  if (!hasPermission(actor.role, permission)) {
    throw new AuthorizationError(`Role ${actor.role} does not have permission "${permission}"`);
  }
  return actor;
}
