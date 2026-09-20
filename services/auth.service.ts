import type { Prisma, Role, TokenPurpose } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { conflict, forbidden, notFound, unauthorized, badRequest } from "@/lib/errors";
import { getDummyHash, hashPassword, randomToken, sha256, verifyPassword } from "@/lib/security";
import { createSession, revokeAllSessions } from "@/lib/session";
import { sendPasswordResetEmail, sendVerificationEmail } from "./email.service";
import type { LoginInput, RegisterInput } from "@/features/auth/schemas";

const HOUR = 3_600_000;

export async function issueToken(userId: string, purpose: TokenPurpose, ttlMs: number) {
  const token = randomToken(32);
  await prisma.verificationToken.updateMany({ where: { userId, purpose, usedAt: null }, data: { usedAt: new Date() } });
  await prisma.verificationToken.create({ data: { userId, purpose, tokenHash: sha256(token), expiresAt: new Date(Date.now() + ttlMs) } });
  return token;
}

async function consumeToken(token: string, purpose: TokenPurpose) {
  const row = await prisma.verificationToken.findUnique({ where: { tokenHash: sha256(token) } });
  if (!row || row.purpose !== purpose || row.usedAt || row.expiresAt < new Date()) throw badRequest("This link is invalid or has expired");
  // Single use: the conditional update fails if a concurrent request consumed it first.
  const res = await prisma.verificationToken.updateMany({ where: { id: row.id, usedAt: null }, data: { usedAt: new Date() } });
  if (res.count !== 1) throw badRequest("This link is invalid or has expired");
  return row;
}

export async function register(input: RegisterInput, meta: { ip?: string; userAgent?: string }) {
  const passwordHash = await hashPassword(input.password);
  const existing = await prisma.user.findUnique({ where: { email: input.email }, select: { id: true } });
  if (existing) throw conflict("An account with this email already exists");

  const result = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    let tenantId: string;
    let role: Role;
    if (input.type === "clinic") {
      const slugTaken = await tx.tenant.findUnique({ where: { slug: input.clinicSlug }, select: { id: true } });
      if (slugTaken) throw conflict("This clinic address is already taken");
      tenantId = (await tx.tenant.create({ data: { name: input.clinicName, slug: input.clinicSlug, email: input.email } })).id;
      role = "CLINIC_ADMIN";
    } else {
      const tenant = await tx.tenant.findFirst({ where: { slug: input.clinicSlug, status: "ACTIVE", deletedAt: null }, select: { id: true } });
      if (!tenant) throw notFound("Clinic not found");
      tenantId = tenant.id;
      role = "PATIENT";
    }
    const user = await tx.user.create({
      data: { email: input.email, passwordHash, firstName: input.firstName, lastName: input.lastName },
    });
    await tx.membership.create({ data: { userId: user.id, tenantId, role } });
    if (input.type === "patient") {
      await tx.patient.create({
        data: { tenantId, userId: user.id, firstName: input.firstName, lastName: input.lastName, dateOfBirth: input.dateOfBirth, email: input.email },
      });
    }
    return { user, tenantId, role };
  });

  const token = await issueToken(result.user.id, "EMAIL_VERIFY", 24 * HOUR);
  await sendVerificationEmail(result.user.email, result.user.firstName, token);
  const session = await createSession({ userId: result.user.id, tenantId: result.tenantId, ...meta });
  return { session, user: { id: result.user.id, email: result.user.email, role: result.role } };
}

export async function login(input: LoginInput, meta: { ip?: string; userAgent?: string }) {
  const user = await prisma.user.findUnique({
    where: { email: input.email },
    include: { memberships: { include: { tenant: { select: { slug: true, status: true, deletedAt: true } } } } },
  });
  // Always run a bcrypt compare so response time does not reveal whether the account exists.
  const valid = await verifyPassword(input.password, user?.passwordHash ?? (await getDummyHash()));
  if (!user || !valid || user.disabledAt) throw unauthorized("Invalid email or password");

  let tenantId: string | null = null;
  let role: Role = "SUPER_ADMIN";
  if (!user.isSuperAdmin || input.clinicSlug) {
    const active = user.memberships.filter((m) => m.tenant.status === "ACTIVE" && !m.tenant.deletedAt);
    const membership = input.clinicSlug ? active.find((m) => m.tenant.slug === input.clinicSlug) : active[0];
    if (!membership) throw forbidden("No active clinic access for this account");
    tenantId = membership.tenantId;
    role = membership.role;
  }
  await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
  const session = await createSession({ userId: user.id, tenantId, ...meta });
  return { session, user: { id: user.id, email: user.email, role, tenantId }, emailVerified: !!user.emailVerifiedAt };
}

export async function requestPasswordReset(email: string) {
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || user.disabledAt) return; // never reveal whether the account exists
  const token = await issueToken(user.id, "PASSWORD_RESET", HOUR);
  await sendPasswordResetEmail(user.email, user.firstName, token);
}

export async function resetPassword(token: string, newPassword: string) {
  const row = await consumeToken(token, "PASSWORD_RESET");
  await prisma.user.update({ where: { id: row.userId }, data: { passwordHash: await hashPassword(newPassword) } });
  await revokeAllSessions(row.userId);
  return row.userId;
}

export async function verifyEmail(token: string) {
  const row = await consumeToken(token, "EMAIL_VERIFY");
  await prisma.user.update({ where: { id: row.userId }, data: { emailVerifiedAt: new Date() } });
  return row.userId;
}

export async function changePassword(userId: string, currentPassword: string, newPassword: string) {
  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
  if (!(await verifyPassword(currentPassword, user.passwordHash))) throw unauthorized("Current password is incorrect");
  await prisma.user.update({ where: { id: userId }, data: { passwordHash: await hashPassword(newPassword) } });
}
