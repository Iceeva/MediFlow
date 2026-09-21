import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { badRequest, conflict, notFound } from "@/lib/errors";
import { requireTenantId } from "@/lib/tenant";
import { env } from "@/lib/env";
import { statusAfterPayment, toMinorUnits } from "@/lib/billing";
import { getProvider } from "@/lib/payments";
import type { PaymentEvent } from "@/lib/payments/types";
import type { AuthContext } from "@/lib/session";
import type { CreatePaymentInput } from "@/features/payments/schemas";
import { getInvoice } from "./invoice.service";
import { notify } from "./notification.service";

const select = {
  id: true, amount: true, method: true, provider: true, providerReference: true, status: true, paidAt: true, createdAt: true,
  invoice: { select: { id: true, number: true, currency: true, patient: { select: { id: true, firstName: true, lastName: true } } } },
} satisfies Prisma.PaymentSelect;

export async function listPayments(auth: AuthContext, f: { invoiceId?: string; status?: "PENDING" | "SUCCEEDED" | "FAILED" | "REFUNDED"; page: number; pageSize: number; order: "asc" | "desc" }) {
  const tenantId = requireTenantId(auth);
  const where: Prisma.PaymentWhereInput = {
    tenantId,
    ...(auth.role === "PATIENT" ? { invoice: { patientId: auth.patientId ?? "none" } } : {}),
    ...(f.invoiceId ? { invoiceId: f.invoiceId } : {}),
    ...(f.status ? { status: f.status } : {}),
  };
  const [items, total] = await Promise.all([
    prisma.payment.findMany({ where, select, orderBy: { createdAt: f.order }, skip: (f.page - 1) * f.pageSize, take: f.pageSize }),
    prisma.payment.count({ where }),
  ]);
  return { items, total };
}

/** Recomputes amountPaid and status from SUCCEEDED payments only, under a row lock on the invoice. */
async function settleInvoice(tx: Prisma.TransactionClient, invoiceId: string) {
  await tx.$queryRaw`SELECT id FROM "Invoice" WHERE id = ${invoiceId}::uuid FOR UPDATE`;
  const inv = await tx.invoice.findUniqueOrThrow({ where: { id: invoiceId }, select: { total: true, dueDate: true, status: true } });
  const agg = await tx.payment.aggregate({ where: { invoiceId, status: "SUCCEEDED" }, _sum: { amount: true } });
  const paid = agg._sum.amount ?? new Prisma.Decimal(0);
  const status = inv.status === "CANCELLED" ? "CANCELLED" : statusAfterPayment(inv.total, paid, inv.dueDate);
  return tx.invoice.update({ where: { id: invoiceId }, data: { amountPaid: paid, status }, select: { total: true, amountPaid: true, number: true, patient: { select: { userId: true } } } });
}

const payable = (status: string) => ["PENDING", "PARTIALLY_PAID", "OVERDUE"].includes(status);

export async function createPayment(auth: AuthContext, input: CreatePaymentInput, headerKey?: string | null) {
  const tenantId = requireTenantId(auth);
  const invoice = await getInvoice(auth, input.invoiceId); // scope: patients only reach their own invoices
  if (!payable(invoice.status)) throw badRequest(`An invoice in status ${invoice.status} cannot receive payments`);
  const balance = new Prisma.Decimal(invoice.total).sub(invoice.amountPaid);
  // Idempotency keys are namespaced per tenant so two clinics can never collide or read each other's payments.
  const rawKey = input.idempotencyKey ?? headerKey;
  if (!rawKey) throw badRequest("An idempotency key is required (body field or Idempotency-Key header)");
  const idempotencyKey = `${tenantId}:${rawKey}`;

  const existing = await prisma.payment.findUnique({ where: { idempotencyKey }, select: { ...select, invoiceId: true } });
  if (existing) {
    if (existing.invoiceId !== invoice.id) throw conflict("This idempotency key was already used for another invoice");
    return { payment: existing, redirectUrl: undefined, replayed: true };
  }

  if (input.mode === "manual") {
    const amount = new Prisma.Decimal(input.amount);
    if (amount.gt(balance)) throw badRequest("The amount exceeds the remaining balance");
    const payment = await prisma.$transaction(async (tx) => {
      const p = await tx.payment.create({
        data: { tenantId, invoiceId: invoice.id, amount, method: input.method, provider: "manual", providerReference: input.reference, idempotencyKey, status: "SUCCEEDED", paidAt: new Date(), createdById: auth.userId },
        select,
      });
      const inv = await settleInvoice(tx, invoice.id);
      await notify({ tenantId, userId: inv.patient.userId, type: "PAYMENT_RECEIVED", title: "Payment received", message: `Payment for ${inv.number} was recorded.`, metadata: { paymentId: p.id } }, tx);
      return p;
    });
    return { payment: payment, redirectUrl: undefined, replayed: false };
  }

  // Online: amount is ALWAYS the server-side balance, never a client value.
  if (balance.lte(0)) throw badRequest("Nothing left to pay on this invoice");
  const provider = getProvider(input.provider);
  const pending = await prisma.payment.create({
    data: { tenantId, invoiceId: invoice.id, amount: balance, method: "CARD", provider: provider.name, idempotencyKey, status: "PENDING", createdById: auth.userId },
    select: { id: true },
  });
  try {
    const base = env().NEXT_PUBLIC_APP_URL;
    const checkout = await provider.createCheckout({
      paymentId: pending.id, invoiceNumber: invoice.number, amountMinor: toMinorUnits(balance, invoice.currency), currency: invoice.currency, idempotencyKey,
      successUrl: `${base}/payments?paid=${pending.id}`, cancelUrl: `${base}/invoices`,
    });
    const payment = await prisma.payment.update({ where: { id: pending.id }, data: { providerReference: checkout.providerReference }, select });
    return { payment, redirectUrl: checkout.redirectUrl, replayed: false };
  } catch (e) {
    await prisma.payment.update({ where: { id: pending.id }, data: { status: "FAILED" } });
    throw e;
  }
}

/**
 * Applies a verified provider event. Idempotent: the WebhookEvent row (unique provider+eventId) is written in the same
 * transaction as the state change, so a retried or duplicated webhook is a harmless no-op.
 */
export async function applyPaymentEvent(provider: string, event: PaymentEvent) {
  if (event.type === "ignored" || !event.providerReference) return { applied: false };
  const payment = await prisma.payment.findFirst({ where: { provider, providerReference: event.providerReference }, include: { invoice: { select: { currency: true } } } });
  if (!payment) throw notFound("Unknown payment reference");
  try {
    return await prisma.$transaction(async (tx) => {
      await tx.webhookEvent.create({ data: { provider, eventId: event.eventId } });
      if (payment.status !== "PENDING") return { applied: false };
      if (event.type === "failed") {
        await tx.payment.update({ where: { id: payment.id }, data: { status: "FAILED" } });
        return { applied: true };
      }
      // Never trust an event whose amount differs from what we asked the provider to charge.
      if (event.amountMinor !== undefined && event.amountMinor !== toMinorUnits(payment.amount, payment.invoice.currency)) {
        await tx.payment.update({ where: { id: payment.id }, data: { status: "FAILED" } });
        return { applied: true, mismatch: true };
      }
      await tx.payment.update({ where: { id: payment.id }, data: { status: "SUCCEEDED", paidAt: new Date() } });
      const inv = await settleInvoice(tx, payment.invoiceId);
      await notify({ tenantId: payment.tenantId, userId: inv.patient.userId, type: "PAYMENT_RECEIVED", title: "Payment received", message: `Payment for ${inv.number} was confirmed.`, metadata: { paymentId: payment.id } }, tx);
      return { applied: true };
    });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") return { applied: false, duplicate: true };
    throw e;
  }
}
