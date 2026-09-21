import { route } from "@/lib/api";
import { ok, parseBody } from "@/lib/http";
import { updateInvoiceSchema } from "@/features/invoices/schemas";
import { getInvoice, updateInvoice } from "@/services/invoice.service";

export const GET = route<{ id: string }>({ permission: "invoice:read" }, async ({ auth, params }) => ok(await getInvoice(auth, params.id)));

export const PATCH = route<{ id: string }>({ permission: "invoice:write" }, async ({ req, auth, params, audit }) => {
  const patch = await parseBody(req, updateInvoiceSchema);
  const inv = await updateInvoice(auth, params.id, patch);
  await audit("invoice.update", "invoice", params.id, { fields: Object.keys(patch) });
  return ok(inv);
});
