import { Prisma } from "@prisma/client";
import { describe, expect, it } from "vitest";
import { computeTotals, statusAfterPayment, toMinorUnits } from "@/lib/billing";

const D = (v: number | string) => new Prisma.Decimal(v);

describe("invoice maths", () => {
  it("computes subtotal, discount, tax and total exactly", () => {
    const t = computeTotals([{ description: "A", quantity: 2, unitPrice: "10.10" }, { description: "B", quantity: 1, unitPrice: 5 }], 5, 10);
    expect(t.subtotal.toString()).toBe("25.2");
    expect(t.discount.toString()).toBe("5");
    expect(t.tax.toString()).toBe("2.02");
    expect(t.total.toString()).toBe("22.22");
  });

  it("never lets the discount exceed the subtotal", () => {
    expect(computeTotals([{ description: "A", quantity: 1, unitPrice: 10 }], 999).total.toString()).toBe("0");
  });

  it("avoids floating point drift", () => {
    expect(computeTotals([{ description: "A", quantity: 3, unitPrice: "0.1" }]).total.toString()).toBe("0.3");
  });
});

describe("invoice status", () => {
  const future = new Date(Date.now() + 86_400_000);
  const past = new Date(Date.now() - 86_400_000);
  it("derives status from what was really paid", () => {
    expect(statusAfterPayment(D(100), D(100), future)).toBe("PAID");
    expect(statusAfterPayment(D(100), D(40), future)).toBe("PARTIALLY_PAID");
    expect(statusAfterPayment(D(100), D(0), future)).toBe("PENDING");
    expect(statusAfterPayment(D(100), D(0), past)).toBe("OVERDUE");
    expect(statusAfterPayment(D(100), D(40), past)).toBe("OVERDUE");
  });
});

describe("provider amounts", () => {
  it("uses the currency minor unit", () => {
    expect(toMinorUnits("15000", "XOF")).toBe(15000);
    expect(toMinorUnits("19.99", "EUR")).toBe(1999);
  });
});
