import { publicRoute } from "@/lib/api";
import { ok, parseBody } from "@/lib/http";
import { forgotSchema } from "@/features/auth/schemas";
import { requestPasswordReset } from "@/services/auth.service";

// Always answers 200 so the endpoint cannot be used to discover which emails have accounts.
export const POST = publicRoute({ rateLimit: { limit: 5, windowSec: 900 } }, async ({ req }) => {
  const { email } = await parseBody(req, forgotSchema);
  await requestPasswordReset(email);
  return ok({ sent: true });
});
