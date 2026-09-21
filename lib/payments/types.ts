export interface CheckoutRequest {
  paymentId: string;
  invoiceNumber: string;
  amountMinor: number;
  currency: string;
  idempotencyKey: string;
  successUrl: string;
  cancelUrl: string;
}

export interface CheckoutResult {
  providerReference: string;
  redirectUrl: string;
}

/** Provider-neutral webhook event. Only `succeeded` and `failed` change our state. */
export interface PaymentEvent {
  eventId: string;
  type: "succeeded" | "failed" | "ignored";
  providerReference?: string;
  amountMinor?: number;
  currency?: string;
}

export interface PaymentProvider {
  readonly name: string;
  createCheckout(req: CheckoutRequest): Promise<CheckoutResult>;
  /** Must verify the signature on the RAW body and throw if it is invalid. */
  parseWebhook(rawBody: string, headers: Headers): PaymentEvent;
}
