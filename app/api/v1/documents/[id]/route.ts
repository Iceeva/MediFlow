import { route } from "@/lib/api";
import { ok } from "@/lib/http";
import { deleteDocument, getDocument } from "@/services/document.service";

export const GET = route<{ id: string }>({ permission: "document:read" }, async ({ auth, params }) => {
  const { storageKey: _omit, ...doc } = await getDocument(auth, params.id);
  void _omit;
  return ok(doc);
});

export const DELETE = route<{ id: string }>({ permission: "document:delete" }, async ({ auth, params, audit }) => {
  await deleteDocument(auth, params.id);
  await audit("document.delete", "document", params.id);
  return ok({ deleted: true });
});
