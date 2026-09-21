import type { InvoiceStatus, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { badRequest, notFound } from "@/lib/errors";
import { requireTenantId } from "@/lib/tenant";
import { computeTotals } from "@/lib/billing";
import { nextNumber } from "@/lib/sequence";
import type { AuthContext } from "@/lib/session";
import { invoiceWhere } from "./scope";
import { notify } from "./notification.service";

// Billing staff see the patient's name only, never clinical data.
const select = {
  id: true, number: true, status: true, subtotal: true, discount: true, tax: true, total: true, amountPaid: true, currency: true, dueDate: true, notes: true, createdAt: true,
  patient: { select: { id: true, firstName: true, lastName: true } },
  items: { select: { id: true, description: true, quantity: true, unitPrice: true, total: true } },
  payments: { select: { id: true, amount: true, method: true, provider: true, status: true, paidAt: true, createdAt: true }, orderBy: { createdAt: "desc" as const } },
} satisfies Prisma.InvoiceSelect;

export async function listInvoices(auth: AuthContext, f: { status?: InvoiceStatus; patientId?: string; q?: string; page: number; pageSize: number; order: "asc" | "desc" }) {
  const where: Prisma.InvoiceWhereInput = {
    AND: [
      invoiceWhere(auth),
      f.status ? { status: f.status } : {},
      f.patientId ? { patientId: f.patientId } : {},
      f.q ? { OR: [{ number: { contains: f.q, mode: "insensitive" } }, { patient: { OR: [{ firstName: { contains: f.q, mode: "insensitive" } }, { lastName: { contains: f.q, mode: "insensitive" } }] } }] } : {},
    ],
  };
  const [items, total] = await Promise.all([
    prisma.invoice.findMany({ where, select, orderBy: { createdAt: f.order }, skip: (f.page - 1) * f.pageSize, take: f.pageSize }),
    prisma.invoice.count({ where }),
  ]);
  return { items, total };
}

export async function getInvoice(auth: AuthContext, id: string) {
  const inv = await prisma.invoice.findFirst({ where: { AND: [invoiceWhere(auth), { id }] }, select });
  if (!inv) throw notFound("Invoice not found");
  // Patients must never see invoices that are still drafts or cancelled.
  if (auth.role === "PATIENT" && ["DRAFT", "CANCELLED"].includes(inv.status)) throw notFound("Invoice not found");
  return inv;
}

export async function createInvoice(
  auth: AuthContext,
  input: { patientId: string; items: { description: string; quantity: number; unitPrice: number }[]; discount: number; taxRatePercent: number; dueDate?: Date; notes?: string; currency: string; issue: boolean },
) {
  const tenantId = requireTenantId(auth);
  const patient = await prisma.patient.findFirst({ where: { id: input.patientId, tenantId, deletedAt: null }, select: { id: true, userId: true } });
  if (!patient) throw notFound("Patient not found");
  const t = computeTotals(input.items, input.discount, input.taxRatePercent);

  return prisma.$transaction(async (tx) => {
    const number = await nextNumber(tx, tenantId, "invoice", "INV");
    const inv = await tx.invoice.create({
      data: {
        tenantId, number, patientId: patient.id, status: input.issue ? "PENDING" : "DRAFT", currency: input.currency, dueDate: input.dueDate, notes: input.notes, createdById: auth.userId,
        subtotal: t.subtotal, discount: t.discount, tax: t.tax, total: t.total,
        items: { create: t.lines },
      },
      select,
    });
    if (input.issue) await notify({ tenantId, userId: patient.userId, type: "INVOICE_ISSUED", title: "New invoice", message: `Invoice ${number} is ready.`, metadata: { invoiceId: inv.id } }, tx);
    return inv;
  });
}

export async function updateInvoice(
  auth: AuthContext,
  id: string,
  patch: { items?: { description: string; quantity: number; unitPrice: number }[]; discount?: number; taxRatePercent?: number; dueDate?: Date | null; notes?: string; status?: "PENDING" | "CANCELLED" },
) {
  const tenantId = requireTenantId(auth);
  const cur = await prisma.invoice.findFirst({ where: { id, tenantId }, include: { items: true, patient: { select: { userId: true } } } });
  if (!cur) throw notFound("Invoice not found");
  if (cur.status === "PAID" || cur.status === "CANCELLED") throw badRequest(`A ${cur.status.toLowerCase()} invoice cannot be changed`);
  const editingLines = patch.items || patch.discount !== undefined || patch.taxRatePercent !== undefined;
  if (editingLines && cur.status !== "DRAFT") throw badRequest("Only draft invoices can have their lines changed");
  if (patch.status === "CANCELLED" && cur.amountPaid.gt(0)) throw badRequest("An invoice with payments cannot be cancelled");
  if (patch.status === "PENDING" && cur.status !== "DRAFT") throw badRequest("Only a draft can be issued");

  const data: Prisma.InvoiceUpdateInput = { dueDate: patch.dueDate, notes: patch.notes, ...(patch.status ? { status: patch.status } : {}) };
  let lines: ReturnType<typeof computeTotals>["lines"] | undefined;
  if (editingLines) {
    const items = patch.items ?? cur.items.map((i) => ({ description: i.description, quantity: i.quantity, unitPrice: i.unitPrice.toString() }));
    const taxRate = patch.taxRatePercent ?? (cur.subtotal.sub(cur.discount).gt(0) ? cur.tax.div(cur.subtotal.sub(cur.discount)).mul(100).toNumber() : 0);
    const t = computeTotals(items, patch.discount ?? cur.discount.toString(), taxRate);
    Object.assign(data, { subtotal: t.subtotal, discount: t.discount, tax: t.tax, total: t.total });
    lines = t.lines;
  }
  return prisma.$transaction(async (tx) => {
    if (lines) {
      await tx.invoiceItem.deleteMany({ where: { invoiceId: id } });
      await tx.invoiceItem.createMany({ data: lines.map((l) => ({ ...l, invoiceId: id })) });
    }
    const inv = await tx.invoice.update({ where: { id }, data, select });
    if (patch.status === "PENDING") await notify({ tenantId, userId: cur.patient.userId, type: "INVOICE_ISSUED", title: "New invoice", message: `Invoice ${cur.number} is ready.`, metadata: { invoiceId: id } }, tx);
    return inv;
  });
}
