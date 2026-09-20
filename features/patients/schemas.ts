import { z } from "zod";

const optionalText = (max: number) => z.string().trim().max(max).optional().or(z.literal("").transform(() => undefined));

export const patientBase = z.object({
  firstName: z.string().trim().min(1).max(80),
  lastName: z.string().trim().min(1).max(80),
  dateOfBirth: z.coerce.date().max(new Date(), "Date of birth cannot be in the future"),
  gender: z.enum(["FEMALE", "MALE", "OTHER", "UNDISCLOSED"]).default("UNDISCLOSED"),
  phone: optionalText(30),
  email: z.string().trim().toLowerCase().email().max(254).optional().or(z.literal("").transform(() => undefined)),
  address: optionalText(200),
  emergencyContactName: optionalText(120),
  emergencyContactPhone: optionalText(30),
  bloodType: z.enum(["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"]).optional(),
  allergies: z.array(z.string().trim().min(1).max(80)).max(50).default([]),
  medicalHistory: optionalText(10_000),
  currentMedications: optionalText(5_000),
  insuranceProvider: optionalText(120),
  insuranceNumber: optionalText(60),
});

export const createPatientSchema = patientBase;
export const updatePatientSchema = patientBase.partial();
export const grantAccessSchema = z.object({ userId: z.string().uuid() });

export type CreatePatientInput = z.infer<typeof createPatientSchema>;
export type UpdatePatientInput = z.infer<typeof updatePatientSchema>;
