import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { HAS_DB, world } from "./db";

// Needs a PostgreSQL database with the schema applied: TEST_DATABASE_URL=postgresql://... npm test
describe.skipIf(!HAS_DB)("tenant isolation and access control (real database)", () => {
  let w: Awaited<ReturnType<typeof world>>;
  let svc: {
    patient: typeof import("@/services/patient.service");
    invoice: typeof import("@/services/invoice.service");
    consult: typeof import("@/services/consultation.service");
    doc: typeof import("@/services/document.service");
    search: typeof import("@/services/search.service");
  };

  beforeAll(async () => {
    w = await world();
    svc = {
      patient: await import("@/services/patient.service"),
      invoice: await import("@/services/invoice.service"),
      consult: await import("@/services/consultation.service"),
      doc: await import("@/services/document.service"),
      search: await import("@/services/search.service"),
    };
    // One appointment, consultation and invoice in tenant A, one invoice in B
    const start = new Date(Date.now() + 86_400_000);
    const appt = await w.prisma.appointment.create({ data: { tenantId: w.A.id, patientId: w.pA.id, doctorId: w.dA.id, startsAt: start, endsAt: new Date(start.getTime() + 1_800_000), createdById: w.asDoctorA.userId, status: "CONFIRMED" } });
    await w.prisma.consultation.create({ data: { tenantId: w.A.id, appointmentId: appt.id, patientId: w.pA.id, doctorId: w.dA.id, diagnosis: "confidential diagnosis" } });
    await w.prisma.invoice.create({ data: { tenantId: w.A.id, number: `INV-A-${w.A.id.slice(0, 4)}`, patientId: w.pA.id, status: "PENDING", total: 100, createdById: w.asAdminA.userId } });
    await w.prisma.invoice.create({ data: { tenantId: w.B.id, number: `INV-B-${w.B.id.slice(0, 4)}`, patientId: w.pB.id, status: "PENDING", total: 50, createdById: w.asAdminA.userId } });
  });
  afterAll(async () => { if (w) await w.cleanup(); });

  it("Tenant A cannot access Tenant B patients", async () => {
    await expect(svc.patient.getPatient(w.asAdminA, w.pB.id)).rejects.toMatchObject({ status: 404 });
    await expect(svc.patient.getPatient(w.asDoctorA, w.pB.id)).rejects.toMatchObject({ status: 404 });
    const list = await svc.patient.listPatients(w.asAdminA, { page: 1, pageSize: 50, order: "asc" }, {});
    expect(list.items.map((p) => p.id)).toEqual([w.pA.id]);
  });

  it("a forged tenantId in the body can never widen access (tenant comes from the session)", async () => {
    // createPatient ignores any tenantId in the input: the row lands in the session tenant
    const created = await svc.patient.createPatient(w.asAdminA, { firstName: "X", lastName: "Y", dateOfBirth: new Date("2000-01-01"), gender: "OTHER", allergies: [], ...({ tenantId: w.B.id } as object) } as never);
    const row = await w.prisma.patient.findUniqueOrThrow({ where: { id: created.id } });
    expect(row.tenantId).toBe(w.A.id);
  });

  it("a patient cannot access another patient's record", async () => {
    await expect(svc.patient.getPatient(w.asPatientA, w.pB.id)).rejects.toMatchObject({ status: 404 });
    const mine = await svc.patient.getPatient(w.asPatientA, w.pA.id);
    expect(mine.id).toBe(w.pA.id);
  });

  it("a doctor only reaches patients linked to them (appointment) or granted", async () => {
    const other = await w.prisma.patient.create({ data: { tenantId: w.A.id, firstName: "Unlinked", lastName: "P", dateOfBirth: new Date("1980-01-01") } });
    await expect(svc.patient.getPatient(w.asDoctorA, other.id)).rejects.toMatchObject({ status: 404 });
    await svc.patient.grantAccess(w.asAdminA, other.id, w.asDoctorA.userId);
    await expect(svc.patient.getPatient(w.asDoctorA, other.id)).resolves.toBeTruthy();
    await svc.patient.revokeAccess(w.asAdminA, other.id, w.asDoctorA.userId);
    await expect(svc.patient.getPatient(w.asDoctorA, other.id)).rejects.toMatchObject({ status: 404 });
  });

  it("an accountant cannot read restricted medical information", async () => {
    await expect(svc.patient.getPatient(w.asAccountantA, w.pA.id)).rejects.toMatchObject({ status: 404 });
    const consultations = await svc.consult.listConsultations(w.asAccountantA, { page: 1, pageSize: 10, order: "desc" });
    expect(consultations.total).toBe(0);
    const found = await svc.search.globalSearch(w.asAccountantA, "PatA");
    expect(found.patients).toHaveLength(0);
  });

  it("a nurse without a grant sees nothing, and a doctor of another tenant sees no consultations", async () => {
    expect((await svc.consult.listConsultations(w.asNurseA, { page: 1, pageSize: 10, order: "desc" })).total).toBe(0);
    expect((await svc.consult.listConsultations(w.asDoctorB, { page: 1, pageSize: 10, order: "desc" })).total).toBe(0);
    expect((await svc.consult.listConsultations(w.asDoctorA, { page: 1, pageSize: 10, order: "desc" })).total).toBe(1);
  });

  it("a patient cannot access another patient's invoice", async () => {
    const bInvoice = await w.prisma.invoice.findFirstOrThrow({ where: { tenantId: w.B.id } });
    await expect(svc.invoice.getInvoice(w.asPatientA, bInvoice.id)).rejects.toMatchObject({ status: 404 });
    await expect(svc.invoice.getInvoice(w.asAdminA, bInvoice.id)).rejects.toMatchObject({ status: 404 });
    const mine = await svc.invoice.listInvoices(w.asPatientA, { page: 1, pageSize: 10, order: "desc" });
    expect(mine.items.map((i) => i.patient.id)).toEqual([w.pA.id]);
  });

  it("an unauthorized user cannot read a medical document", async () => {
    const d = await w.prisma.medicalDocument.create({ data: { tenantId: w.A.id, patientId: w.pA.id, fileName: "lab.pdf", storageKey: `k-${Math.random()}`, storageProvider: "s3", mimeType: "application/pdf", size: 10, uploadedById: w.asDoctorA.userId, accessPolicy: "STAFF_ONLY" } });
    await expect(svc.doc.getDocument(w.asPatientA, d.id)).rejects.toMatchObject({ status: 404 }); // staff only
    await expect(svc.doc.getDocument(w.asDoctorB, d.id)).rejects.toMatchObject({ status: 404 }); // other tenant
    await expect(svc.doc.getDocument(w.asAccountantA, d.id)).rejects.toMatchObject({ status: 404 }); // no clinical scope
    await expect(svc.doc.getDocument(w.asDoctorA, d.id)).resolves.toBeTruthy();
  });
});
