import { route } from "@/lib/api";
import { created, paged, parseBody, parseQuery } from "@/lib/http";
import { createInvoiceSchema, listInvoicesSchema } from "@/features/invoices/schemas";
import { createInvoice, listInvoices } from "@/services/invoice.service";

export const GET = route({ permission: "invoice:read" }, async ({ auth, query }) => {
  const f = parseQuery(query, listInvoicesSchema);
  const { items, total } = await listInvoices(auth, f);
  return paged(items, total, { page: f.page, pageSize: f.pageSize, order: f.order });
});

export const POST = route({ permission: "invoice:write" }, async ({ req, auth, audit }) => {
  const input = await parseBody(req, createInvoiceSchema);
  const inv = await createInvoice(auth, input);
  await audit("invoice.create", "invoice", inv.id, { number: inv.number });
  return created(inv);
});
