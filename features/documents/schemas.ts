import { z } from "zod";

export const uploadFieldsSchema = z.object({
  patientId: z.string().uuid(),
  type: z.enum(["PDF", "IMAGE", "SCAN", "LAB_RESULT", "MEDICAL_REPORT", "PRESCRIPTION", "INVOICE", "OTHER"]).default("OTHER"),
  accessPolicy: z.enum(["STAFF_ONLY", "PATIENT_VISIBLE"]).default("STAFF_ONLY"),
});

export const listDocumentsSchema = z.object({
  patientId: z.string().uuid().optional(),
  type: z.enum(["PDF", "IMAGE", "SCAN", "LAB_RESULT", "MEDICAL_REPORT", "PRESCRIPTION", "INVOICE", "OTHER"]).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  q: z.string().max(100).optional(),
  order: z.enum(["asc", "desc"]).default("desc"),
});
