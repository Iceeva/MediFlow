import { publicRoute } from "@/lib/api";
import { ok, parseBody } from "@/lib/http";
import { verifySchema } from "@/features/auth/schemas";
import { verifyEmail } from "@/services/auth.service";

export const POST = publicRoute({ rateLimit: { limit: 20, windowSec: 900 } }, async ({ req }) => {
  const { token } = await parseBody(req, verifySchema);
  await verifyEmail(token);
  return ok({ verified: true });
});
