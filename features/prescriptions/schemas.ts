import { z } from "zod";

export const medicationSchema = z.object({
  name: z.string().trim().min(2).max(120),
  genericName: z.string().trim().max(120).optional(),
  dosageForm: z.string().trim().max(60).optional(),
  strength: z.string().trim().max(60).optional(),
  manufacturer: z.string().trim().max(120).optional(),
  status: z.enum(["ACTIVE", "DISCONTINUED"]).default("ACTIVE"),
});
export const updateMedicationSchema = medicationSchema.partial();

export const prescriptionItemSchema = z.object({
  medicationId: z.string().uuid().optional(),
  medicationName: z.string().trim().min(2).max(160),
  dosage: z.string().trim().min(1).max(80),
  frequency: z.string().trim().min(1).max(80),
  duration: z.string().trim().min(1).max(80),
  route: z.string().trim().max(60).optional(),
  instructions: z.string().trim().max(1000).optional(),
});

export const createPrescriptionSchema = z.object({
  patientId: z.string().uuid(),
  consultationId: z.string().uuid().optional(),
  notes: z.string().trim().max(2000).optional(),
  items: z.array(prescriptionItemSchema).min(1, "Add at least one medication").max(30),
});

export type CreatePrescriptionInput = z.infer<typeof createPrescriptionSchema>;
