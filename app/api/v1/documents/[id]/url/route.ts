import { route } from "@/lib/api";
import { ok } from "@/lib/http";
import { storage } from "@/lib/storage";
import { getDocument } from "@/services/document.service";

// Issues a short-lived signed link. Access is checked here AND again when the link is used.
export const POST = route<{ id: string }>({ permission: "document:read", rateLimit: { limit: 60, windowSec: 600 } }, async ({ auth, params }) => {
  await getDocument(auth, params.id);
  return ok(storage.getSignedUrl({ documentId: params.id, userId: auth.userId, ttlSec: 120 }));
});
