import { NextResponse } from "next/server";
import { publicRoute } from "@/lib/api";
import { getProvider } from "@/lib/payments";
import { applyPaymentEvent } from "@/services/payment.service";
import { writeAudit } from "@/lib/audit";
import { logger } from "@/lib/logger";
import { badRequest } from "@/lib/errors";

export const runtime = "nodejs";

// Provider webhooks: no cookies, no same-origin check. The signature on the RAW body is the authentication.
// Query: /api/v1/payments/webhook?provider=stripe
export const POST = publicRoute({ csrf: false }, async ({ req, query, ip, userAgent }) => {
  const providerName = query.get("provider") ?? "stripe";
  const raw = await req.text();
  let event;
  try {
    event = getProvider(providerName).parseWebhook(raw, req.headers);
  } catch (e) {
    logger.warn("webhook_rejected", { provider: providerName, reason: e instanceof Error ? e.message : "unknown" });
    await writeAudit({ action: "payment.webhook", resource: "payment", result: "DENIED", ip, userAgent });
    throw badRequest("Invalid webhook signature");
  }
  const res = await applyPaymentEvent(providerName, event);
  await writeAudit({ action: "payment.webhook", resource: "payment", metadata: { provider: providerName, type: event.type, applied: res.applied }, ip, userAgent });
  // Always 2xx once the signature is valid, otherwise the provider retries forever.
  return NextResponse.json({ received: true, ...res });
});
