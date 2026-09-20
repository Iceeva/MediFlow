import type { AuditResult, Prisma } from "@prisma/client";
import { prisma } from "./prisma";
import { logger } from "./logger";

export interface AuditInput {
  tenantId?: string | null;
  userId?: string | null;
  action: string;
  resource: string;
  resourceId?: string | null;
  result?: AuditResult;
  ip?: string;
  userAgent?: string;
  metadata?: Prisma.InputJsonValue;
}

/** Append-only audit trail. A failure to write is logged but must not take the request down. */
export async function writeAudit(input: AuditInput) {
  try {
    await prisma.auditLog.create({
      data: {
        tenantId: input.tenantId ?? null,
        userId: input.userId ?? null,
        action: input.action,
        resource: input.resource,
        resourceId: input.resourceId ?? null,
        result: input.result ?? "SUCCESS",
        ip: input.ip,
        userAgent: input.userAgent?.slice(0, 300),
        metadata: input.metadata,
      },
    });
  } catch (e) {
    logger.error("audit_write_failed", { action: input.action, error: e instanceof Error ? e.message : "unknown" });
  }
}
