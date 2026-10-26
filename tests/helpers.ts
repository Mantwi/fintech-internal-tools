import { prisma } from "@/lib/db";
import { seedDatabase } from "@/prisma/seed-data";

export const USERS = {
  analystAlex: "user_alex",
  analystJordan: "user_jordan",
  leadMorgan: "user_morgan",
  leadSam: "user_sam",
  admin: "user_taylor",
} as const;

/** Restores the synthetic dataset. Refuses to run against anything but the test DB. */
export async function resetDatabase() {
  if (process.env.DATABASE_URL !== "file:./test.db") {
    throw new Error(`Refusing to reset non-test database: ${process.env.DATABASE_URL}`);
  }
  await seedDatabase(prisma);
}

export async function auditEventsFor(caseId: string) {
  return prisma.auditEvent.findMany({ where: { resourceId: caseId }, orderBy: { createdAt: "asc" } });
}
