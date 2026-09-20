import "server-only";
import type { NextRequest } from "next/server";
import { Prisma } from "@prisma/client";
import { ZodError } from "zod";
import { getAuth, type AuthContext } from "./session";
import { canAny, type Permission } from "./permissions";
import { ApiError, badRequest, conflict, forbidden, notFound, unauthorized, unprocessable } from "./errors";
import { errorResponse } from "./http";
import { enforceRateLimit } from "./rate-limit";
import { writeAudit } from "./audit";
import { logger } from "./logger";

type Params = Record<string, string>;

export interface RouteOptions {
  /** User needs at least one of these permissions. */
  permission?: Permission | Permission[];
  /** Fixed window limit per client IP and route. */
  rateLimit?: { limit: number; windowSec: number };
  /** Disable the same-origin check (webhooks and cron only). */
  csrf?: boolean;
}

export interface Ctx<P extends Params, A> {
  req: NextRequest;
  auth: A;
  params: P;
  query: URLSearchParams;
  ip: string;
  userAgent: string;
  audit: (action: string, resource: string, resourceId?: string | null, metadata?: Prisma.InputJsonValue) => Promise<void>;
}

const clientIp = (req: NextRequest) =>
  req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || req.headers.get("x-real-ip") || "unknown";

function assertSameOrigin(req: NextRequest) {
  if (["GET", "HEAD", "OPTIONS"].includes(req.method)) return;
  const origin = req.headers.get("origin");
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
  if (origin && host && new URL(origin).host !== host) throw forbidden("Cross-origin request rejected");
  if (req.headers.get("sec-fetch-site") === "cross-site") throw forbidden("Cross-site request rejected");
}

export function toResponse(e: unknown) {
  if (e instanceof ApiError) return errorResponse(e);
  if (e instanceof ZodError) return errorResponse(unprocessable("Validation failed", e.flatten()));
  if (e instanceof Prisma.PrismaClientKnownRequestError) {
    if (e.code === "P2002") return errorResponse(conflict("A record with the same unique value already exists"));
    if (e.code === "P2025") return errorResponse(notFound());
    if (e.code === "P2003") return errorResponse(badRequest("A referenced record does not exist"));
    if (e.code === "P2034") return errorResponse(conflict("The operation conflicted with a concurrent request, please retry"));
  }
  logger.error("unhandled_error", { error: e instanceof Error ? e.message : "unknown" });
  return errorResponse(new ApiError(500, "INTERNAL_ERROR", "Something went wrong"));
}

function build<P extends Params, A extends AuthContext | null>(
  opts: RouteOptions,
  requireAuth: boolean,
  handler: (ctx: Ctx<P, A>) => Promise<Response>,
) {
  return async (req: NextRequest, segment: { params: Promise<P> }) => {
    const ip = clientIp(req);
    const userAgent = req.headers.get("user-agent") ?? "";
    let auth: AuthContext | null = null;
    try {
      if (opts.csrf !== false) assertSameOrigin(req);
      if (opts.rateLimit) await enforceRateLimit(`${req.nextUrl.pathname}:${req.method}:${ip}`, opts.rateLimit.limit, opts.rateLimit.windowSec);

      if (requireAuth) {
        auth = await getAuth();
        if (!auth) throw unauthorized();
        const needed = opts.permission ? ([] as Permission[]).concat(opts.permission) : [];
        if (needed.length && !canAny(auth.role, needed)) {
          await writeAudit({ tenantId: auth.tenantId, userId: auth.userId, action: `denied:${needed.join("|")}`, resource: req.nextUrl.pathname, result: "DENIED", ip, userAgent });
          throw forbidden();
        }
      }
      const params = (await segment.params) as P;
      const a = auth;
      return await handler({
        req,
        auth: auth as A,
        params,
        query: req.nextUrl.searchParams,
        ip,
        userAgent,
        audit: (action, resource, resourceId, metadata) =>
          writeAudit({ tenantId: a?.tenantId, userId: a?.userId, action, resource, resourceId, ip, userAgent, metadata }),
      });
    } catch (e) {
      return toResponse(e);
    }
  };
}

/** Authenticated route: session, permission and (optionally) rate limit are enforced before the handler runs. */
export function route<P extends Params = Params>(opts: RouteOptions, handler: (ctx: Ctx<P, AuthContext>) => Promise<Response>) {
  return build<P, AuthContext>(opts, true, handler);
}

/** Public route (login, register, webhooks). The auth context is null. */
export function publicRoute<P extends Params = Params>(opts: RouteOptions, handler: (ctx: Ctx<P, null>) => Promise<Response>) {
  return build<P, null>(opts, false, handler);
}
