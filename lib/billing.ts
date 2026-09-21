import { Prisma } from "@prisma/client";

const D = (v: Prisma.Decimal.Value) => new Prisma.Decimal(v);

export interface LineInput { description: string; quantity: number; unitPrice: number | string }

/** Server-side money maths with Decimal. The client never sends totals. */
export function computeTotals(items: LineInput[], discount: number | string = 0, taxRatePercent: number | string = 0) {
  const lines = items.map((i) => ({ description: i.description, quantity: i.quantity, unitPrice: D(i.unitPrice), total: D(i.unitPrice).mul(i.quantity).toDecimalPlaces(2) }));
  const subtotal = lines.reduce((acc, l) => acc.add(l.total), D(0));
  const disc = Prisma.Decimal.min(D(discount), subtotal).toDecimalPlaces(2);
  const taxable = subtotal.sub(disc);
  const tax = taxable.mul(D(taxRatePercent)).div(100).toDecimalPlaces(2);
  return { lines, subtotal, discount: disc, tax, total: taxable.add(tax).toDecimalPlaces(2) };
}

export type InvoiceStatusValue = "DRAFT" | "PENDING" | "PARTIALLY_PAID" | "PAID" | "CANCELLED" | "OVERDUE";

/** Status derived from what has really been paid. */
export function statusAfterPayment(total: Prisma.Decimal, paid: Prisma.Decimal, dueDate: Date | null, now = new Date()): InvoiceStatusValue {
  if (paid.gte(total) && total.gt(0)) return "PAID";
  if (paid.gt(0)) return dueDate && dueDate < now ? "OVERDUE" : "PARTIALLY_PAID";
  return dueDate && dueDate < now ? "OVERDUE" : "PENDING";
}

export const ZERO_DECIMAL_CURRENCIES = new Set(["XOF", "XAF", "JPY", "KRW", "GNF", "RWF", "UGX", "VND"]);

/** Provider amounts are integers in the currency's minor unit. */
export function toMinorUnits(amount: Prisma.Decimal.Value, currency: string): number {
  const factor = ZERO_DECIMAL_CURRENCIES.has(currency.toUpperCase()) ? 1 : 100;
  return D(amount).mul(factor).round().toNumber();
}
