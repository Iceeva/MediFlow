import { prisma } from "./prisma";
import { tooManyRequests } from "./errors";

/**
 * Fixed-window rate limiter backed by PostgreSQL (one atomic upsert), so it works across
 * serverless instances without Redis. Keep it for sensitive routes (auth, uploads, search, exports).
 */
export async function enforceRateLimit(key: string, limit: number, windowSec: number) {
  const resetAt = new Date(Date.now() + windowSec * 1000);
  const rows = await prisma.$queryRaw<{ count: number; resetAt: Date }[]>`
    INSERT INTO "RateLimit" ("key", "count", "resetAt", "updatedAt")
    VALUES (${key}, 1, ${resetAt}, now())
    ON CONFLICT ("key") DO UPDATE SET
      "count"   = CASE WHEN "RateLimit"."resetAt" < now() THEN 1 ELSE "RateLimit"."count" + 1 END,
      "resetAt" = CASE WHEN "RateLimit"."resetAt" < now() THEN ${resetAt} ELSE "RateLimit"."resetAt" END,
      "updatedAt" = now()
    RETURNING "count", "resetAt"`;
  const row = rows[0];
  if (Math.random() < 0.01) void prisma.rateLimit.deleteMany({ where: { resetAt: { lt: new Date() } } }).catch(() => undefined);
  if (row && row.count > limit) {
    throw tooManyRequests(Math.max(1, Math.ceil((row.resetAt.getTime() - Date.now()) / 1000)));
  }
}
