import { route } from "@/lib/api";
import { created, paged, parseBody, parseQuery } from "@/lib/http";
import { createPaymentSchema, listPaymentsSchema } from "@/features/payments/schemas";
import { createPayment, listPayments } from "@/services/payment.service";
import { forbidden } from "@/lib/errors";
import { can } from "@/lib/permissions";

export const GET = route({ permission: "payment:read" }, async ({ auth, query }) => {
  const f = parseQuery(query, listPaymentsSchema);
  const { items, total } = await listPayments(auth, f);
  return paged(items, total, { page: f.page, pageSize: f.pageSize, order: f.order });
});

export const POST = route({ permission: ["payment:write", "payment:initiate"], rateLimit: { limit: 30, windowSec: 600 } }, async ({ req, auth, audit }) => {
  const input = await parseBody(req, createPaymentSchema);
  // Recording cash/bank money requires payment:write. Patients can only start an online payment.
  if (input.mode === "manual" && !can(auth.role, "payment:write")) throw forbidden("Only billing staff can record manual payments");
  const res = await createPayment(auth, input, req.headers.get("idempotency-key"));
  await audit(input.mode === "manual" ? "payment.record" : "payment.initiate", "payment", res.payment.id, { replayed: res.replayed });
  return created({ payment: res.payment, redirectUrl: res.redirectUrl, replayed: res.replayed });
});
