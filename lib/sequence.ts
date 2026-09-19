import type { Prisma, PrismaClient } from "@prisma/client";

type Tx = Prisma.TransactionClient | PrismaClient;

/** Atomic per-tenant sequence, e.g. INV-2026-00042. Safe under concurrency (single upsert). */
export async function nextNumber(tx: Tx, tenantId: string, name: "invoice" | "prescription", prefix: string) {
  const row = await tx.sequenceCounter.upsert({
    where: { tenantId_name: { tenantId, name } },
    create: { tenantId, name, value: 1 },
    update: { value: { increment: 1 } },
  });
  return `${prefix}-${new Date().getFullYear()}-${String(row.value).padStart(5, "0")}`;
}
