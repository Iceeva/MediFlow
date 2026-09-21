import { route } from "@/lib/api";
import { forbidden } from "@/lib/errors";
import { verifyDownload } from "@/lib/storage/signed-url";
import { readDocument } from "@/services/document.service";

export const GET = route<{ id: string }>({ permission: "document:read", rateLimit: { limit: 60, windowSec: 600 } }, async ({ auth, params, query, audit }) => {
  const token = query.get("token");
  if (!token || !verifyDownload(token, params.id, auth.userId)) throw forbidden("This download link is invalid or has expired");
  const { body, fileName, mimeType, patientId } = await readDocument(auth, params.id);
  await audit("document.download", "document", params.id, { patientId });
  return new Response(new Uint8Array(body), {
    headers: {
      "Content-Type": mimeType,
      "Content-Length": String(body.length),
      "Content-Disposition": `attachment; filename="${encodeURIComponent(fileName)}"`,
      "X-Content-Type-Options": "nosniff",
      "Cache-Control": "private, no-store",
    },
  });
});
