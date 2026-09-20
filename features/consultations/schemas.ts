import { z } from "zod";

const text = z.string().trim().max(10_000).optional();

export const vitalsSchema = z.object({
  systolic: z.number().int().min(40).max(300).optional(),
  diastolic: z.number().int().min(20).max(200).optional(),
  heartRate: z.number().int().min(20).max(260).optional(),
  temperatureC: z.number().min(30).max(45).optional(),
  weightKg: z.number().min(0.3).max(500).optional(),
  heightCm: z.number().min(20).max(260).optional(),
  oxygenSaturation: z.number().int().min(50).max(100).optional(),
});

export const createConsultationSchema = z.object({
  appointmentId: z.string().uuid(),
  symptoms: text, diagnosis: text, observations: text, treatment: text, notes: text,
  followUpAt: z.coerce.date().optional(),
  vitals: vitalsSchema.optional(),
});

export const updateConsultationSchema = createConsultationSchema.omit({ appointmentId: true, vitals: true }).partial();

export const createVitalSchema = vitalsSchema.extend({ patientId: z.string().uuid(), consultationId: z.string().uuid().optional() })
  .refine((v) => Object.entries(v).some(([k, val]) => !["patientId", "consultationId"].includes(k) && val !== undefined), "Provide at least one measurement");
