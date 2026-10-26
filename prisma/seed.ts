import { PrismaClient } from "@prisma/client";
import { DEMO_CASES, DEMO_USERS, seedDatabase } from "./seed-data";

const prisma = new PrismaClient();

seedDatabase(prisma)
  .then(() => {
    console.log(`Seeded ${DEMO_USERS.length} demo users and ${DEMO_CASES.length} synthetic KYC cases.`);
  })
  .catch((error) => {
    console.error("Seeding failed:", error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
