import { describe, expect, it } from "vitest";
import { can, ROLE_PERMISSIONS, PERMISSIONS } from "@/lib/permissions";

describe("RBAC matrix", () => {
  it("only SUPER_ADMIN manages tenants", () => {
    for (const role of Object.keys(ROLE_PERMISSIONS) as (keyof typeof ROLE_PERMISSIONS)[]) {
      expect(can(role, "tenant:manage")).toBe(role === "SUPER_ADMIN");
    }
  });

  it("ACCOUNTANT cannot access any clinical information", () => {
    for (const p of ["patient:read", "patient:clinical", "consultation:read", "prescription:read", "document:read", "vital:write"] as const) {
      expect(can("ACCOUNTANT", p)).toBe(false);
    }
    expect(can("ACCOUNTANT", "invoice:write")).toBe(true);
  });

  it("RECEPTIONIST sees patients but not clinical data", () => {
    expect(can("RECEPTIONIST", "patient:read")).toBe(true);
    expect(can("RECEPTIONIST", "patient:clinical")).toBe(false);
    expect(can("RECEPTIONIST", "consultation:read")).toBe(false);
    expect(can("RECEPTIONIST", "invoice:write")).toBe(false);
  });

  it("only DOCTOR can write consultations and prescriptions", () => {
    for (const role of Object.keys(ROLE_PERMISSIONS) as (keyof typeof ROLE_PERMISSIONS)[]) {
      expect(can(role, "consultation:write")).toBe(role === "DOCTOR");
      expect(can(role, "prescription:write")).toBe(role === "DOCTOR");
    }
  });

  it("PATIENT can book and read own data but never write staff resources", () => {
    expect(can("PATIENT", "appointment:book")).toBe(true);
    expect(can("PATIENT", "appointment:write")).toBe(false);
    expect(can("PATIENT", "patient:write")).toBe(false);
    expect(can("PATIENT", "invoice:write")).toBe(false);
    expect(can("PATIENT", "payment:write")).toBe(false);
    expect(can("PATIENT", "audit:read")).toBe(false);
  });

  it("audit log is limited to admins", () => {
    for (const role of Object.keys(ROLE_PERMISSIONS) as (keyof typeof ROLE_PERMISSIONS)[]) {
      expect(can(role, "audit:read")).toBe(role === "CLINIC_ADMIN" || role === "SUPER_ADMIN");
    }
  });

  it("every permission referenced by a role exists", () => {
    for (const perms of Object.values(ROLE_PERMISSIONS)) for (const p of perms) expect(PERMISSIONS).toContain(p);
  });
});
