import { PrismaClient } from "@prisma/client";

// Single Prisma client per process (avoids exhausting connections during Next.js hot reload).
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

export type Db = PrismaClient | Parameters<Parameters<PrismaClient["$transaction"]>[0]>[0];
