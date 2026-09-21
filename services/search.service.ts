import { prisma } from "@/lib/prisma";
import { can } from "@/lib/permissions";
import { requireTenantId } from "@/lib/tenant";
import type { AuthContext } from "@/lib/session";
import { appointmentWhere, clinicalWhere, documentWhere, invoiceWhere, patientWhere } from "./scope";

const ci = (q: string) => ({ contains: q, mode: "insensitive" as const });
const LIMIT = 5;

/**
 * Global search over PostgreSQL (ILIKE backed by the composite indexes). Every group reuses the same
 * scope fragments as the list endpoints, so search can never reveal more than the lists do.
 */
export async function globalSearch(auth: AuthContext, q: string) {
  const tenantId = requireTenantId(auth);
  const r = auth.role;
  const [patients, doctors, appointments, invoices, documents, prescriptions] = await Promise.all([
    can(r, "patient:read")
      ? prisma.patient.findMany({ where: { AND: [patientWhere(auth), { OR: [{ firstName: ci(q) }, { lastName: ci(q) }, { email: ci(q) }, { phone: { contains: q } }] }] }, select: { id: true, firstName: true, lastName: true, dateOfBirth: true }, take: LIMIT })
      : [],
    can(r, "doctor:read")
      ? prisma.doctor.findMany({ where: { tenantId, deletedAt: null, OR: [{ specialization: ci(q) }, { user: { OR: [{ firstName: ci(q) }, { lastName: ci(q) }] } }] }, select: { id: true, specialization: true, user: { select: { firstName: true, lastName: true } } }, take: LIMIT })
      : [],
    can(r, "appointment:read")
      ? prisma.appointment.findMany({ where: { AND: [appointmentWhere(auth), { OR: [{ reason: ci(q) }, { patient: { OR: [{ firstName: ci(q) }, { lastName: ci(q) }] } }] }] }, select: { id: true, startsAt: true, status: true, patient: { select: { firstName: true, lastName: true } } }, orderBy: { startsAt: "desc" }, take: LIMIT })
      : [],
    can(r, "invoice:read")
      ? prisma.invoice.findMany({ where: { AND: [invoiceWhere(auth), { OR: [{ number: ci(q) }, { patient: { OR: [{ firstName: ci(q) }, { lastName: ci(q) }] } }] }] }, select: { id: true, number: true, status: true, total: true }, take: LIMIT })
      : [],
    can(r, "document:read")
      ? prisma.medicalDocument.findMany({ where: { AND: [documentWhere(auth), { fileName: ci(q) }] }, select: { id: true, fileName: true, type: true }, take: LIMIT })
      : [],
    can(r, "prescription:read")
      ? prisma.prescription.findMany({ where: { AND: [clinicalWhere(auth), { OR: [{ number: ci(q) }, { items: { some: { medicationName: ci(q) } } }] }] }, select: { id: true, number: true, issuedAt: true }, take: LIMIT })
      : [],
  ]);
  return { patients, doctors, appointments, invoices, documents, prescriptions };
}
