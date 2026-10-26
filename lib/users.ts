import { prisma } from "@/lib/db";

/** Demo identities for the header switcher. Contains no customer data. */
export async function listDemoUsers() {
  return prisma.user.findMany({ select: { id: true, name: true, role: true }, orderBy: [{ role: "asc" }, { name: "asc" }] });
}
