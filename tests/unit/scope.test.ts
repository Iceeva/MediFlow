import { describe, expect, it } from "vitest";
import { appointmentWhere, documentWhere, invoiceWhere, patientWhere } from "@/services/scope";
import { requireTenantId } from "@/lib/tenant";
import { ctx, uuid } from "../helpers";

describe("tenant context", () => {
  it("is taken from the session and super admins have none", () => {
    expect(requireTenantId(ctx("DOCTOR"))).toBe(uuid(1));
    expect(() => requireTenantId(ctx("SUPER_ADMIN"))).toThrow();
  });

  it("every scope contains the session tenant", () => {
    for (const role of ["CLINIC_ADMIN", "DOCTOR", "NURSE", "RECEPTIONIST", "ACCOUNTANT", "PATIENT"] as const) {
      const a = ctx(role, { doctorId: uuid(5), patientId: uuid(6) });
      expect(patientWhere(a)).toMatchObject({ tenantId: uuid(1) });
      expect(appointmentWhere(a)).toMatchObject({ tenantId: uuid(1) });
      expect(invoiceWhere(a)).toMatchObject({ tenantId: uuid(1) });
    }
  });
});

describe("patient row scope", () => {
  it("patients only reach their own record", () => {
    expect(patientWhere(ctx("PATIENT", { patientId: uuid(6) }))).toMatchObject({ id: uuid(6) });
  });

  it("a patient account without a linked record matches nothing", () => {
    const w = patientWhere(ctx("PATIENT", { patientId: null }));
    expect(w).toMatchObject({ id: "00000000-0000-0000-0000-000000000000" });
  });

  it("doctors reach patients through their appointments or an explicit grant", () => {
    const w = patientWhere(ctx("DOCTOR", { doctorId: uuid(5) })) as { OR: unknown[] };
    expect(w.OR).toHaveLength(2);
    expect(JSON.stringify(w)).toContain(uuid(5));
  });

  it("nurses need an explicit grant", () => {
    expect(patientWhere(ctx("NURSE"))).toMatchObject({ accessGrants: { some: { userId: uuid(100) } } });
  });

  it("accountants fail closed on patient records", () => {
    expect(patientWhere(ctx("ACCOUNTANT"))).toMatchObject({ id: "00000000-0000-0000-0000-000000000000" });
  });
});

describe("other scopes", () => {
  it("patients only see their own invoices and visible documents", () => {
    const a = ctx("PATIENT", { patientId: uuid(6) });
    expect(invoiceWhere(a)).toMatchObject({ patientId: uuid(6) });
    expect(documentWhere(a)).toMatchObject({ accessPolicy: "PATIENT_VISIBLE", deletedAt: null });
  });

  it("doctors only see their own appointments", () => {
    expect(appointmentWhere(ctx("DOCTOR", { doctorId: uuid(5) }))).toMatchObject({ doctorId: uuid(5) });
  });
});
