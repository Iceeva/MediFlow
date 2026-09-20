import { z } from "zod";

export const staffRoles = ["CLINIC_ADMIN", "DOCTOR", "NURSE", "RECEPTIONIST", "ACCOUNTANT"] as const;

export const createUserSchema = z
  .object({
    email: z.string().trim().toLowerCase().email().max(254),
    firstName: z.string().trim().min(1).max(80),
    lastName: z.string().trim().min(1).max(80),
    phone: z.string().trim().max(30).optional(),
    role: z.enum(staffRoles),
    // Doctor profile
    specialization: z.string().trim().max(120).optional(),
    licenseNumber: z.string().trim().max(60).optional(),
    consultationFee: z.coerce.number().min(0).max(10_000_000).optional(),
    // Other staff
    jobTitle: z.string().trim().max(120).optional(),
    department: z.string().trim().max(120).optional(),
    // Only honoured for SUPER_ADMIN, who has no tenant context of their own
    tenantId: z.string().uuid().optional(),
  })
  .superRefine((v, ctx) => {
    if (v.role === "DOCTOR" && (!v.specialization || !v.licenseNumber)) {
      ctx.addIssue({ code: "custom", path: ["specialization"], message: "Doctors need a specialization and a license number" });
    }
  });

export const updateUserSchema = z.object({
  role: z.enum(staffRoles).optional(),
  disabled: z.boolean().optional(),
  firstName: z.string().trim().min(1).max(80).optional(),
  lastName: z.string().trim().min(1).max(80).optional(),
  phone: z.string().trim().max(30).nullable().optional(),
});

export const createTenantSchema = z.object({
  name: z.string().trim().min(2).max(120),
  slug: z.string().trim().toLowerCase().regex(/^[a-z0-9-]{3,40}$/),
  email: z.string().email().optional(),
  phone: z.string().max(30).optional(),
  address: z.string().max(200).optional(),
  timezone: z.string().max(60).default("UTC"),
  admin: z.object({
    email: z.string().trim().toLowerCase().email(),
    firstName: z.string().trim().min(1).max(80),
    lastName: z.string().trim().min(1).max(80),
  }),
});

export const updateTenantSchema = z.object({
  name: z.string().trim().min(2).max(120).optional(),
  email: z.string().email().nullable().optional(),
  phone: z.string().max(30).nullable().optional(),
  address: z.string().max(200).nullable().optional(),
  timezone: z.string().max(60).optional(),
  status: z.enum(["ACTIVE", "SUSPENDED"]).optional(), // status: SUPER_ADMIN only
});

export type CreateUserInput = z.infer<typeof createUserSchema>;
