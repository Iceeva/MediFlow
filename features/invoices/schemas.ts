import { z } from "zod";

export const invoiceItemSchema = z.object({
  description: z.string().trim().min(1).max(200),
  quantity: z.number().int().min(1).max(10_000),
  unitPrice: z.number().min(0).max(100_000_000),
});

export const createInvoiceSchema = z.object({
  patientId: z.string().uuid(),
  items: z.array(invoiceItemSchema).min(1, "Add at least one line").max(100),
  discount: z.number().min(0).default(0),
  taxRatePercent: z.number().min(0).max(100).default(0),
  dueDate: z.coerce.date().optional(),
  notes: z.string().trim().max(2000).optional(),
  currency: z.string().length(3).toUpperCase().default("XOF"),
  issue: z.boolean().default(false), // true = PENDING straight away, false = DRAFT
});

export const updateInvoiceSchema = z.object({
  items: z.array(invoiceItemSchema).min(1).max(100).optional(),
  discount: z.number().min(0).optional(),
  taxRatePercent: z.number().min(0).max(100).optional(),
  dueDate: z.coerce.date().nullable().optional(),
  notes: z.string().trim().max(2000).optional(),
  status: z.enum(["PENDING", "CANCELLED"]).optional(),
});

export const listInvoicesSchema = z.object({
  status: z.enum(["DRAFT", "PENDING", "PARTIALLY_PAID", "PAID", "CANCELLED", "OVERDUE"]).optional(),
  patientId: z.string().uuid().optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  q: z.string().max(60).optional(),
  order: z.enum(["asc", "desc"]).default("desc"),
});
