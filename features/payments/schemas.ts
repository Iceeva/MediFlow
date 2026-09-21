import { z } from "zod";

export const ONLINE_PROVIDERS = ["stripe"] as const;

export const createPaymentSchema = z.discriminatedUnion("mode", [
  // Staff records money received at the desk. Confirmed immediately by an authorized human.
  z.object({
    mode: z.literal("manual"),
    invoiceId: z.string().uuid(),
    amount: z.number().positive().max(100_000_000),
    method: z.enum(["CASH", "CARD", "BANK_TRANSFER", "MOBILE_MONEY", "INSURANCE"]),
    reference: z.string().trim().max(120).optional(),
    idempotencyKey: z.string().min(8).max(100).optional(),
  }),
  // Online payment: stays PENDING until the provider webhook confirms it server-side.
  z.object({
    mode: z.literal("online"),
    invoiceId: z.string().uuid(),
    provider: z.enum(ONLINE_PROVIDERS),
    idempotencyKey: z.string().min(8).max(100).optional(),
  }),
]);

export const listPaymentsSchema = z.object({
  invoiceId: z.string().uuid().optional(),
  status: z.enum(["PENDING", "SUCCEEDED", "FAILED", "REFUNDED"]).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  order: z.enum(["asc", "desc"]).default("desc"),
});

export type CreatePaymentInput = z.infer<typeof createPaymentSchema>;
