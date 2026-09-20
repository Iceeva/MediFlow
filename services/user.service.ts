import type { Prisma, Role } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { conflict, forbidden, notFound } from "@/lib/errors";
import { hashPassword, randomToken } from "@/lib/security";
import { issueToken } from "./auth.service";
import { sendPasswordResetEmail } from "./email.service";
import type { CreateUserInput } from "@/features/users/schemas";
import type { Pagination } from "@/lib/http";
import { pageArgs } from "@/lib/http";

/**
 * Creates a staff account. The person receives a "set your password" email: the admin never
 * knows or chooses their password. The account starts with an unusable random password.
 */
export async function createStaffUser(tenantId: string, input: CreateUserInput) {
  if (await prisma.user.findUnique({ where: { email: input.email }, select: { id: true } })) {
    throw conflict("An account with this email already exists");
  }
  const user = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    const u = await tx.user.create({
      data: { email: input.email, firstName: input.firstName, lastName: input.lastName, phone: input.phone, passwordHash: await hashPassword(randomToken(24)) },
    });
    await tx.membership.create({ data: { userId: u.id, tenantId, role: input.role } });
    if (input.role === "DOCTOR") {
      await tx.doctor.create({
        data: { tenantId, userId: u.id, specialization: input.specialization!, licenseNumber: input.licenseNumber!, phone: input.phone, consultationFee: input.consultationFee ?? 0 },
      });
    } else {
      await tx.staffProfile.create({ data: { tenantId, userId: u.id, jobTitle: input.jobTitle, department: input.department, phone: input.phone } });
    }
    return u;
  });
  const token = await issueToken(user.id, "PASSWORD_RESET", 48 * 3_600_000);
  await sendPasswordResetEmail(user.email, user.firstName, token);
  return { id: user.id, email: user.email, role: input.role };
}

export async function listTenantUsers(tenantId: string, p: Pagination, role?: Role) {
  const where: Prisma.MembershipWhereInput = {
    tenantId,
    ...(role ? { role } : {}),
    ...(p.q ? { user: { OR: [{ firstName: { contains: p.q, mode: "insensitive" } }, { lastName: { contains: p.q, mode: "insensitive" } }, { email: { contains: p.q, mode: "insensitive" } }] } } : {}),
  };
  const [rows, total] = await Promise.all([
    prisma.membership.findMany({
      where, ...pageArgs(p), orderBy: { createdAt: "desc" },
      select: { role: true, createdAt: true, user: { select: { id: true, email: true, firstName: true, lastName: true, phone: true, disabledAt: true, lastLoginAt: true } } },
    }),
    prisma.membership.count({ where }),
  ]);
  return { total, items: rows.map((r) => ({ ...r.user, role: r.role, disabled: !!r.user.disabledAt, memberSince: r.createdAt })) };
}

export async function updateTenantUser(tenantId: string, actorId: string, userId: string, patch: { role?: Role; disabled?: boolean; firstName?: string; lastName?: string; phone?: string | null }) {
  const membership = await prisma.membership.findUnique({ where: { userId_tenantId: { userId, tenantId } } });
  if (!membership) throw notFound("User not found in this clinic");
  if (userId === actorId && (patch.disabled || (patch.role && patch.role !== membership.role))) {
    throw forbidden("You cannot disable your own account or change your own role");
  }
  if (membership.role === "PATIENT" && patch.role) throw forbidden("Patient accounts cannot be promoted to staff");
  await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    if (patch.role && patch.role !== membership.role) await tx.membership.update({ where: { id: membership.id }, data: { role: patch.role } });
    const data: Prisma.UserUpdateInput = { firstName: patch.firstName, lastName: patch.lastName, phone: patch.phone };
    if (patch.disabled !== undefined) data.disabledAt = patch.disabled ? new Date() : null;
    await tx.user.update({ where: { id: userId }, data });
    if (patch.disabled) await tx.session.updateMany({ where: { userId, revokedAt: null }, data: { revokedAt: new Date() } });
  });
  return { id: userId };
}
