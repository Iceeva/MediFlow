import { z } from "zod";

const hhmm = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Use HH:mm");

export const availabilitySchema = z.object({
  slots: z
    .array(z.object({ dayOfWeek: z.number().int().min(0).max(6), startTime: hhmm, endTime: hhmm }))
    .max(35)
    .refine((slots) => slots.every((s) => s.startTime < s.endTime), "Each slot must end after it starts"),
});

export const updateDoctorSchema = z.object({
  specialization: z.string().trim().min(2).max(120).optional(),
  licenseNumber: z.string().trim().min(2).max(60).optional(),
  phone: z.string().trim().max(30).nullable().optional(),
  consultationFee: z.coerce.number().min(0).max(10_000_000).optional(),
  status: z.enum(["ACTIVE", "ON_LEAVE", "INACTIVE"]).optional(),
});
