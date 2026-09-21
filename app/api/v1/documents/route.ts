import { route } from "@/lib/api";
import { created, paged, parseQuery } from "@/lib/http";
import { badRequest } from "@/lib/errors";
import { listDocumentsSchema, uploadFieldsSchema } from "@/features/documents/schemas";
import { listDocuments, uploadDocument } from "@/services/document.service";
import { MAX_UPLOAD_BYTES } from "@/lib/storage/validate";

export const GET = route({ permission: "document:read" }, async ({ auth, query }) => {
  const f = parseQuery(query, listDocumentsSchema);
  const { items, total } = await listDocuments(auth, f);
  return paged(items, total, { page: f.page, pageSize: f.pageSize, order: f.order });
});

export const POST = route({ permission: "document:write", rateLimit: { limit: 30, windowSec: 600 } }, async ({ req, auth, audit }) => {
  const declared = Number(req.headers.get("content-length") ?? 0);
  if (declared > MAX_UPLOAD_BYTES + 64 * 1024) throw badRequest("The upload is too large");
  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof File)) throw badRequest("A file is required");
  if (file.size > MAX_UPLOAD_BYTES) throw badRequest("The file is too large");
  const fields = uploadFieldsSchema.parse({ patientId: form.get("patientId"), type: form.get("type") ?? undefined, accessPolicy: form.get("accessPolicy") ?? undefined });
  const doc = await uploadDocument(auth, fields as never, { name: file.name, type: file.type, body: Buffer.from(await file.arrayBuffer()) });
  await audit("document.upload", "document", doc.id, { patientId: fields.patientId, size: doc.size });
  return created(doc);
});
