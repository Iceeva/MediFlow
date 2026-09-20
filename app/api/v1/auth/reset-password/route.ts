import { publicRoute } from "@/lib/api";
import { ok, parseBody } from "@/lib/http";
import { resetSchema } from "@/features/auth/schemas";
import { resetPassword } from "@/services/auth.service";
import { writeAudit } from "@/lib/audit";

export const POST = publicRoute({ rateLimit: { limit: 10, windowSec: 900 } }, async ({ req, ip, userAgent }) => {
  const { token, password } = await parseBody(req, resetSchema);
  const userId = await resetPassword(token, password);
  await writeAudit({ userId, action: "auth.password.reset", resource: "user", resourceId: userId, ip, userAgent });
  return ok({ reset: true });
});
