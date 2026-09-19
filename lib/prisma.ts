import { PrismaClient } from "@prisma/client";

// Reuse one client across hot reloads in development and across warm serverless invocations.
// DATABASE_URL must point to a pooled connection (pgbouncer / serverless pooler) on Vercel.
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
