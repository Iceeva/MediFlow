import type { Role } from "@prisma/client";

export const PERMISSIONS = [
  "tenant:manage", "analytics:global",
  "user:manage", "user:read", "staff:manage",
  "patient:read", "patient:clinical", "patient:write", "patient:archive", "patient:grant",
  "doctor:read", "doctor:manage",
  "appointment:read", "appointment:write", "appointment:book",
  "consultation:read", "consultation:write", "vital:write",
  "prescription:read", "prescription:write",
  "medication:read", "medication:manage",
  "document:read", "document:write", "document:delete",
  "invoice:read", "invoice:write", "payment:read", "payment:write",
  "notification:read", "analytics:read", "audit:read", "search:use",
] as const;

export type Permission = (typeof PERMISSIONS)[number];

const COMMON: Permission[] = ["notification:read"];

// Least privilege: the matrix grants coarse capabilities, row-level scope is enforced in services/scope.ts.
export const ROLE_PERMISSIONS: Record<Role, readonly Permission[]> = {
  SUPER_ADMIN: [...COMMON, "tenant:manage", "analytics:global", "user:manage", "user:read", "audit:read"],
  CLINIC_ADMIN: [
    ...COMMON, "user:manage", "user:read", "staff:manage",
    "patient:read", "patient:clinical", "patient:write", "patient:archive", "patient:grant",
    "doctor:read", "doctor:manage",
    "appointment:read", "appointment:write",
    "medication:read", "medication:manage",
    "invoice:read", "invoice:write", "payment:read", "payment:write",
    "analytics:read", "audit:read", "search:use",
  ],
  DOCTOR: [
    ...COMMON, "patient:read", "patient:clinical", "doctor:read",
    "appointment:read", "appointment:write",
    "consultation:read", "consultation:write", "vital:write",
    "prescription:read", "prescription:write", "medication:read",
    "document:read", "document:write", "analytics:read", "search:use",
  ],
  NURSE: [
    ...COMMON, "patient:read", "patient:clinical", "doctor:read",
    "appointment:read", "consultation:read", "vital:write",
    "prescription:read", "medication:read", "document:read", "search:use",
  ],
  RECEPTIONIST: [
    ...COMMON, "patient:read", "patient:write", "doctor:read",
    "appointment:read", "appointment:write", "search:use",
  ],
  ACCOUNTANT: [
    ...COMMON, "invoice:read", "invoice:write", "payment:read", "payment:write", "analytics:read", "search:use",
  ],
  PATIENT: [
    ...COMMON, "patient:read", "patient:clinical", "doctor:read",
    "appointment:read", "appointment:book", "prescription:read",
    "document:read", "invoice:read", "payment:read",
  ],
};

export const can = (role: Role, permission: Permission) => ROLE_PERMISSIONS[role].includes(permission);
export const canAny = (role: Role, permissions: readonly Permission[]) => permissions.some((p) => can(role, p));

export const STAFF_ROLES: Role[] = ["CLINIC_ADMIN", "DOCTOR", "NURSE", "RECEPTIONIST", "ACCOUNTANT"];
