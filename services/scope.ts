import type { Prisma } from "@prisma/client";
import type { AuthContext } from "@/lib/session";
import { requireTenantId } from "@/lib/tenant";

/**
 * Row-level scoping. Every query for tenant data starts from one of these `where` fragments.
 * They always contain tenantId taken from the session, then narrow further by role.
 * A role that must never see a table gets an impossible filter (fail closed).
 */
const NOTHING = "00000000-0000-0000-0000-000000000000";

export function patientWhere(auth: AuthContext): Prisma.PatientWhereInput {
  const tenantId = requireTenantId(auth);
  const base = { tenantId, deletedAt: null };
  switch (auth.role) {
    case "CLINIC_ADMIN":
    case "RECEPTIONIST":
      return base;
    case "PATIENT":
      return { ...base, id: auth.patientId ?? NOTHING };
    case "DOCTOR":
      // A doctor reaches patients they have an appointment with, or that were explicitly granted.
      return { ...base, OR: [{ appointments: { some: { doctorId: auth.doctorId ?? NOTHING } } }, { accessGrants: { some: { userId: auth.userId } } }] };
    case "NURSE":
      return { ...base, accessGrants: { some: { userId: auth.userId } } };
    default:
      return { ...base, id: NOTHING };
  }
}

export function appointmentWhere(auth: AuthContext): Prisma.AppointmentWhereInput {
  const tenantId = requireTenantId(auth);
  if (auth.role === "PATIENT") return { tenantId, patientId: auth.patientId ?? NOTHING };
  if (auth.role === "DOCTOR") return { tenantId, doctorId: auth.doctorId ?? NOTHING };
  return { tenantId };
}

/** Clinical records follow patient access: if you cannot see the patient you cannot see their chart. */
export function clinicalWhere(auth: AuthContext): { tenantId: string; patient: { is: Prisma.PatientWhereInput } } {
  return { tenantId: requireTenantId(auth), patient: { is: patientWhere(auth) } };
}

export function documentWhere(auth: AuthContext): Prisma.MedicalDocumentWhereInput {
  const base = { ...clinicalWhere(auth), deletedAt: null };
  return auth.role === "PATIENT" ? { ...base, accessPolicy: "PATIENT_VISIBLE" } : base;
}

export function invoiceWhere(auth: AuthContext): Prisma.InvoiceWhereInput {
  const tenantId = requireTenantId(auth);
  return auth.role === "PATIENT" ? { tenantId, patientId: auth.patientId ?? NOTHING } : { tenantId };
}

export const isClinicalRole = (auth: AuthContext) => ["DOCTOR", "NURSE", "CLINIC_ADMIN", "PATIENT"].includes(auth.role);
