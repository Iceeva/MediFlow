import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { can } from "@/lib/permissions";
import { notFound } from "@/lib/errors";
import { requireTenantId } from "@/lib/tenant";
import { orderBy, pageArgs, type Pagination } from "@/lib/http";
import type { AuthContext } from "@/lib/session";
import type { CreatePatientInput, UpdatePatientInput } from "@/features/patients/schemas";
import { patientWhere } from "./scope";

const BASIC = { id: true, firstName: true, lastName: true, dateOfBirth: true, gender: true, phone: true, email: true, address: true, archivedAt: true, createdAt: true } as const;
const CLINICAL = {
  ...BASIC, emergencyContactName: true, emergencyContactPhone: true, bloodType: true, allergies: true,
  medicalHistory: true, currentMedications: true, insuranceProvider: true, insuranceNumber: true, updatedAt: true,
} as const;

/** Receptionists see demographics only. Clinical fields need patient:clinical. */
const select = (auth: AuthContext) => (can(auth.role, "patient:clinical") ? CLINICAL : BASIC);

export interface PatientFilters { archived?: boolean; gender?: "FEMALE" | "MALE" | "OTHER" | "UNDISCLOSED" }

export async function listPatients(auth: AuthContext, p: Pagination, f: PatientFilters) {
  const and: Prisma.PatientWhereInput[] = [patientWhere(auth)];
  and.push(f.archived ? { archivedAt: { not: null } } : { archivedAt: null });
  if (f.gender) and.push({ gender: f.gender });
  if (p.q) {
    and.push({ OR: [
      { firstName: { contains: p.q, mode: "insensitive" } },
      { lastName: { contains: p.q, mode: "insensitive" } },
      { email: { contains: p.q, mode: "insensitive" } },
      { phone: { contains: p.q } },
    ] });
  }
  const where = { AND: and };
  const [items, total] = await Promise.all([
    prisma.patient.findMany({ where, select: select(auth), orderBy: orderBy(p, ["lastName", "firstName", "createdAt", "dateOfBirth"] as const, "lastName"), ...pageArgs(p) }),
    prisma.patient.count({ where }),
  ]);
  return { items, total };
}

export async function getPatient(auth: AuthContext, id: string) {
  const patient = await prisma.patient.findFirst({ where: { AND: [patientWhere(auth), { id }] }, select: select(auth) });
  if (!patient) throw notFound("Patient not found");
  return patient;
}

export async function createPatient(auth: AuthContext, input: CreatePatientInput) {
  const tenantId = requireTenantId(auth);
  return prisma.patient.create({ data: { ...input, tenantId }, select: { id: true } });
}

export async function updatePatient(auth: AuthContext, id: string, input: UpdatePatientInput) {
  await getPatient(auth, id); // existence + scope check
  const clinicalEditor = can(auth.role, "patient:clinical");
  // Receptionists cannot write clinical fields even if they send them.
  const { medicalHistory, currentMedications, allergies, bloodType, insuranceProvider, insuranceNumber, ...demographic } = input;
  const data = clinicalEditor ? input : demographic;
  void medicalHistory; void currentMedications; void allergies; void bloodType; void insuranceProvider; void insuranceNumber;
  return prisma.patient.update({ where: { id }, data, select: { id: true } });
}

export async function archivePatient(auth: AuthContext, id: string, archived: boolean) {
  await getPatient(auth, id);
  return prisma.patient.update({ where: { id }, data: { archivedAt: archived ? new Date() : null }, select: { id: true, archivedAt: true } });
}

/** Soft delete. The row stays for audit and legal retention. */
export async function deletePatient(auth: AuthContext, id: string) {
  await getPatient(auth, id);
  return prisma.patient.update({ where: { id }, data: { deletedAt: new Date(), archivedAt: new Date() }, select: { id: true } });
}

export async function grantAccess(auth: AuthContext, patientId: string, userId: string) {
  const tenantId = requireTenantId(auth);
  await getPatient(auth, patientId);
  const member = await prisma.membership.findFirst({ where: { userId, tenantId, role: { in: ["DOCTOR", "NURSE"] } }, select: { id: true } });
  if (!member) throw notFound("Clinical staff member not found");
  return prisma.patientAccess.upsert({
    where: { patientId_userId: { patientId, userId } },
    create: { tenantId, patientId, userId, grantedBy: auth.userId },
    update: {},
    select: { id: true },
  });
}

export async function revokeAccess(auth: AuthContext, patientId: string, userId: string) {
  await getPatient(auth, patientId);
  await prisma.patientAccess.deleteMany({ where: { tenantId: requireTenantId(auth), patientId, userId } });
}

export async function patientTimeline(auth: AuthContext, id: string) {
  await getPatient(auth, id);
  const tenantId = requireTenantId(auth);
  const [consultations, prescriptions, vitals] = await Promise.all([
    prisma.consultation.findMany({ where: { tenantId, patientId: id }, orderBy: { createdAt: "desc" }, take: 50, select: { id: true, diagnosis: true, createdAt: true, doctor: { select: { user: { select: { firstName: true, lastName: true } } } } } }),
    prisma.prescription.findMany({ where: { tenantId, patientId: id }, orderBy: { issuedAt: "desc" }, take: 50, select: { id: true, number: true, issuedAt: true } }),
    prisma.vital.findMany({ where: { tenantId, patientId: id }, orderBy: { recordedAt: "desc" }, take: 50 }),
  ]);
  return { consultations, prescriptions, vitals };
}
