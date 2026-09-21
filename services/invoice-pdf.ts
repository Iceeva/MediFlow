import { prisma } from "@/lib/prisma";
import { PdfBuilder } from "@/lib/pdf";
import { requireTenantId } from "@/lib/tenant";
import type { AuthContext } from "@/lib/session";
import { getInvoice } from "./invoice.service";

const money = (v: { toString(): string }, cur: string) => `${Number(v.toString()).toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 2 })} ${cur}`;

export async function renderInvoicePdf(auth: AuthContext, id: string) {
  const inv = await getInvoice(auth, id); // role and tenant scope enforced here
  const tenant = await prisma.tenant.findUniqueOrThrow({ where: { id: requireTenantId(auth) }, select: { name: true, address: true, phone: true } });
  const pdf = await PdfBuilder.create();
  pdf.header(tenant.name, `Invoice ${inv.number}`, `${inv.status}  -  issued ${inv.createdAt.toISOString().slice(0, 10)}${inv.dueDate ? `  -  due ${inv.dueDate.toISOString().slice(0, 10)}` : ""}`);
  pdf.kv("Billed to", `${inv.patient.firstName} ${inv.patient.lastName}`);
  if (tenant.address) pdf.kv("Clinic address", tenant.address);
  pdf.rule();
  pdf.row([{ t: "Description", w: 270, bold: true }, { t: "Qty", w: 50, bold: true, align: "right" }, { t: "Unit price", w: 90, bold: true, align: "right" }, { t: "Total", w: 88, bold: true, align: "right" }]);
  pdf.rule();
  for (const i of inv.items) {
    pdf.row([{ t: i.description, w: 270 }, { t: String(i.quantity), w: 50, align: "right" }, { t: money(i.unitPrice, inv.currency), w: 90, align: "right" }, { t: money(i.total, inv.currency), w: 88, align: "right" }]);
  }
  pdf.rule();
  const sum = (label: string, v: string, bold = false) => pdf.row([{ t: label, w: 320, bold, align: "right" }, { t: v, w: 178, bold, align: "right" }]);
  sum("Subtotal", money(inv.subtotal, inv.currency));
  if (Number(inv.discount) > 0) sum("Discount", `- ${money(inv.discount, inv.currency)}`);
  if (Number(inv.tax) > 0) sum("Tax", money(inv.tax, inv.currency));
  sum("Total", money(inv.total, inv.currency), true);
  sum("Paid", money(inv.amountPaid, inv.currency));
  sum("Balance due", money(Number(inv.total.toString()) - Number(inv.amountPaid.toString()), inv.currency), true);
  if (inv.notes) { pdf.rule(); pdf.text(inv.notes, { size: 9 }); }
  return { bytes: await pdf.finish(`${tenant.name}  -  ${inv.number}`), fileName: `${inv.number}.pdf` };
}
