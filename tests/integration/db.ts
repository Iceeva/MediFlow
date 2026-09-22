import type { Role } from "@prisma/client";
import type { AuthContext } from "@/lib/session";

export const HAS_DB = !!process.env.TEST_DATABASE_URL;
// Must run before anything imports @/lib/prisma
if (HAS_DB) process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;

export async function world() {
  const { prisma } = await import("@/lib/prisma");
  const tag = Math.random().toString(36).slice(2, 8);
  const mkTenant = (n: string) => prisma.tenant.create({ data: { name: `${n} ${tag}`, slug: `${n}-${tag}` } });
  const mkUser = (email: string) => prisma.user.create({ data: { email: `${email}.${tag}@test.dev`, firstName: email, lastName: "Test", passwordHash: "x" } });
  const member = (userId: string, tenantId: string, role: Role) => prisma.membership.create({ data: { userId, tenantId, role } });

  const [A, B] = await Promise.all([mkTenant("a"), mkTenant("b")]);
  const [docA, docB, patUserA, patUserB, accA, nurseA, adminA] = await Promise.all(["docA", "docB", "patA", "patB", "accA", "nurseA", "adminA"].map(mkUser));
  await Promise.all([member(docA!.id, A.id, "DOCTOR"), member(docB!.id, B.id, "DOCTOR"), member(patUserA!.id, A.id, "PATIENT"), member(patUserB!.id, B.id, "PATIENT"), member(accA!.id, A.id, "ACCOUNTANT"), member(nurseA!.id, A.id, "NURSE"), member(adminA!.id, A.id, "CLINIC_ADMIN")]);
  const mkDoctor = (userId: string, tenantId: string, lic: string) => prisma.doctor.create({ data: { userId, tenantId, specialization: "GP", licenseNumber: `${lic}-${tag}` } });
  const mkPatient = (userId: string, tenantId: string, name: string) => prisma.patient.create({ data: { userId, tenantId, firstName: name, lastName: "Patient", dateOfBirth: new Date("1990-01-01"), medicalHistory: "secret history" } });
  const [dA, dB] = await Promise.all([mkDoctor(docA!.id, A.id, "A"), mkDoctor(docB!.id, B.id, "B")]);
  const [pA, pB] = await Promise.all([mkPatient(patUserA!.id, A.id, "PatA"), mkPatient(patUserB!.id, B.id, "PatB")]);

  const auth = (role: Role, userId: string, tenantId: string, extra: Partial<AuthContext> = {}): AuthContext =>
    ({ sessionId: "s", userId, email: "e", name: "n", role, tenantId, doctorId: null, patientId: null, ...extra });

  return {
    prisma, A, B, dA, dB, pA, pB,
    asDoctorA: auth("DOCTOR", docA!.id, A.id, { doctorId: dA.id }),
    asDoctorB: auth("DOCTOR", docB!.id, B.id, { doctorId: dB.id }),
    asPatientA: auth("PATIENT", patUserA!.id, A.id, { patientId: pA.id }),
    asPatientB: auth("PATIENT", patUserB!.id, B.id, { patientId: pB.id }),
    asAccountantA: auth("ACCOUNTANT", accA!.id, A.id),
    asNurseA: auth("NURSE", nurseA!.id, A.id),
    asAdminA: auth("CLINIC_ADMIN", adminA!.id, A.id),
    userIds: { adminA: adminA!.id },
    cleanup: async () => {
      await prisma.tenant.deleteMany({ where: { id: { in: [A.id, B.id] } } });
      await prisma.user.deleteMany({ where: { email: { endsWith: `.${tag}@test.dev` } } });
      await prisma.$disconnect();
    },
  };
}
