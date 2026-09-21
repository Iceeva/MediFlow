import { ApiError } from "@/lib/errors";
import { stripeProvider } from "./stripe";
import type { PaymentProvider } from "./types";

export type { PaymentProvider } from "./types";

// Register new providers here. Each one implements PaymentProvider (checkout + signed webhook parsing).
const providers: Record<string, PaymentProvider> = { stripe: stripeProvider };

export function getProvider(name: string): PaymentProvider {
  const p = providers[name];
  if (!p) {
    // TODO (NOT IMPLEMENTED): Mobile Money and bank-transfer gateways. Add an adapter implementing
    // PaymentProvider, register it above, and add its name to ONLINE_PROVIDERS in features/payments/schemas.ts.
    throw new ApiError(501, "NOT_IMPLEMENTED", `Payment provider "${name}" is not implemented`);
  }
  return p;
}
