import Stripe from "stripe";
import { env } from "@/lib/env";
import type { PaymentEvent, PaymentProvider } from "./types";

let client: Stripe | undefined;
const stripe = () => {
  const key = env().PAYMENT_SECRET_KEY;
  if (!key) throw new Error("PAYMENT_SECRET_KEY is not configured");
  return (client ??= new Stripe(key));
};

export const stripeProvider: PaymentProvider = {
  name: "stripe",
  async createCheckout(r) {
    const session = await stripe().checkout.sessions.create(
      {
        mode: "payment",
        success_url: r.successUrl,
        cancel_url: r.cancelUrl,
        client_reference_id: r.paymentId,
        metadata: { paymentId: r.paymentId },
        line_items: [{ quantity: 1, price_data: { currency: r.currency.toLowerCase(), unit_amount: r.amountMinor, product_data: { name: `Invoice ${r.invoiceNumber}` } } }],
      },
      { idempotencyKey: r.idempotencyKey },
    );
    if (!session.url) throw new Error("Stripe did not return a checkout URL");
    return { providerReference: session.id, redirectUrl: session.url };
  },
  parseWebhook(rawBody, headers): PaymentEvent {
    const secret = env().PAYMENT_WEBHOOK_SECRET;
    const sig = headers.get("stripe-signature");
    if (!secret || !sig) throw new Error("Missing webhook secret or signature");
    const event = stripe().webhooks.constructEvent(rawBody, sig, secret); // throws on a bad signature
    if (event.type === "checkout.session.completed" || event.type === "checkout.session.async_payment_succeeded") {
      const s = event.data.object as Stripe.Checkout.Session;
      return { eventId: event.id, type: s.payment_status === "paid" ? "succeeded" : "ignored", providerReference: s.id, amountMinor: s.amount_total ?? undefined, currency: s.currency?.toUpperCase() };
    }
    if (event.type === "checkout.session.expired" || event.type === "checkout.session.async_payment_failed") {
      return { eventId: event.id, type: "failed", providerReference: (event.data.object as Stripe.Checkout.Session).id };
    }
    return { eventId: event.id, type: "ignored" };
  },
};
