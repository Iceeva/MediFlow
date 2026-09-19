import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import type { Role } from "@prisma/client";
import { prisma } from "./prisma";
import { env, isProd } from "./env";
import { hmac, randomToken } from "./security";

export const SESSION_COOKIE = "mf_session";
const TTL_MS = 7 * 24 * 60 * 60 * 1000;
const TOUCH_AFTER_MS = 10 * 60 * 1000;

export interface AuthContext {
  sessionId: string;
  userId: string;
  email: string;
  name: string;
  role: Role;
  tenantId: string | null; // null only for SUPER_ADMIN
  doctorId: string | null;
  patientId: string | null;
}

// Only a keyed hash of the token is stored: a database leak does not yield usable sessions.
const hashToken = (token: string) => hmac(env().AUTH_SECRET, token);

export async function createSession(input: { userId: string; tenantId: string | null; ip?: string; userAgent?: string }) {
  const token = randomToken(32);
  const expiresAt = new Date(Date.now() + TTL_MS);
  await prisma.session.create({
    data: { userId: input.userId, tenantId: input.tenantId, tokenHash: hashToken(token), ip: input.ip, userAgent: input.userAgent?.slice(0, 300), expiresAt },
  });
  return { token, expiresAt };
}

export async function setSessionCookie(token: string, expires: Date) {
  (await cookies()).set(SESSION_COOKIE, token, { httpOnly: true, secure: isProd(), sameSite: "lax", path: "/", expires });
}

export async function clearSessionCookie() {
  (await cookies()).set(SESSION_COOKIE, "", { httpOnly: true, secure: isProd(), sameSite: "lax", path: "/", maxAge: 0 });
}

export async function loadAuth(token: string): Promise<AuthContext | null> {
  const session = await prisma.session.findUnique({
    where: { tokenHash: hashToken(token) },
    include: {
      user: {
        include: {
          doctor: { select: { id: true, tenantId: true } },
          patient: { select: { id: true, tenantId: true } },
          memberships: { include: { tenant: { select: { status: true, deletedAt: true } } } },
        },
      },
    },
  });
  const now = Date.now();
  if (!session || session.revokedAt || session.expiresAt.getTime() < now) return null;
  const { user } = session;
  if (user.disabledAt) return null;

  let role: Role;
  if (!session.tenantId) {
    if (!user.isSuperAdmin) return null;
    role = "SUPER_ADMIN";
  } else {
    const membership = user.memberships.find((m) => m.tenantId === session.tenantId);
    if (!membership || membership.tenant.deletedAt || membership.tenant.status !== "ACTIVE") return null;
    role = membership.role;
  }

  // Sliding expiration: refresh only occasionally to avoid a write per request.
  if (now - session.lastUsedAt.getTime() > TOUCH_AFTER_MS) {
    const extend = session.expiresAt.getTime() - now < TTL_MS / 2;
    await prisma.session.update({
      where: { id: session.id },
      data: { lastUsedAt: new Date(), ...(extend ? { expiresAt: new Date(now + TTL_MS) } : {}) },
    });
  }

  return {
    sessionId: session.id,
    userId: user.id,
    email: user.email,
    name: `${user.firstName} ${user.lastName}`,
    role,
    tenantId: session.tenantId,
    doctorId: user.doctor && user.doctor.tenantId === session.tenantId ? user.doctor.id : null,
    patientId: user.patient && user.patient.tenantId === session.tenantId ? user.patient.id : null,
  };
}

/** Resolve the current request's auth context from the HTTP-only cookie. Memoized per React request. */
export const getAuth = cache(async (): Promise<AuthContext | null> => {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  return token ? loadAuth(token) : null;
});

export const listSessions = (userId: string) =>
  prisma.session.findMany({
    where: { userId, revokedAt: null, expiresAt: { gt: new Date() } },
    select: { id: true, ip: true, userAgent: true, createdAt: true, lastUsedAt: true, expiresAt: true },
    orderBy: { lastUsedAt: "desc" },
  });

export const revokeSession = (userId: string, sessionId: string) =>
  prisma.session.updateMany({ where: { id: sessionId, userId, revokedAt: null }, data: { revokedAt: new Date() } });

export const revokeOtherSessions = (userId: string, keepSessionId: string) =>
  prisma.session.updateMany({ where: { userId, revokedAt: null, id: { not: keepSessionId } }, data: { revokedAt: new Date() } });

export const revokeAllSessions = (userId: string) =>
  prisma.session.updateMany({ where: { userId, revokedAt: null }, data: { revokedAt: new Date() } });

/** Token rotation: issue a fresh token for the same user/tenant and revoke the old session. */
export async function rotateSession(auth: AuthContext, meta: { ip?: string; userAgent?: string }) {
  const next = await createSession({ userId: auth.userId, tenantId: auth.tenantId, ...meta });
  await prisma.session.update({ where: { id: auth.sessionId }, data: { revokedAt: new Date() } });
  await setSessionCookie(next.token, next.expiresAt);
}
