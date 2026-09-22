import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { HAS_DB, world } from "./db";

describe.skipIf(!HAS_DB)("double booking and payment idempotency (real database)", () => {
  let w: Awaited<ReturnType<typeof world>>;
  let appts: typeof import("@/services/appointment.service");
  let pay: typeof import("@/services/payment.service");

  beforeAll(async () => {
    w = await world();
    appts = await import("@/services/appointment.service");
    pay = await import("@/services/payment.service");
  });
  afterAll(async () => { if (w) await w.cleanup(); });

  const slot = (offsetMin: number) => {
    const s = new Date(Date.now() + 2 * 86_400_000 + offsetMin * 60_000);
    s.setSeconds(0, 0);
    return { startsAt: s, endsAt: new Date(s.getTime() + 30 * 60_000) };
  };

  it("rejects an overlapping appointment for the same doctor", async () => {
    const t = slot(0);
    await appts.createAppointment(w.asAdminA, { patientId: w.pA.id, doctorId: w.dA.id, ...t });
    const second = await w.prisma.patient.create({ data: { tenantId: w.A.id, firstName: "Two", lastName: "P", dateOfBirth: new Date("1991-01-01") } });
    await expect(appts.createAppointment(w.asAdminA, { patientId: second.id, doctorId: w.dA.id, ...slot(10) })).rejects.toMatchObject({ status: 409 });
    await expect(appts.createAppointment(w.asAdminA, { patientId: second.id, doctorId: w.dA.id, ...slot(30) })).resolves.toBeTruthy(); // back to back is fine
  });

  it("lets only one of many concurrent bookings win", async () => {
    const t = slot(600);
    const people = await Promise.all(Array.from({ length: 5 }, (_, i) => w.prisma.patient.create({ data: { tenantId: w.A.id, firstName: `C${i}`, lastName: "P", dateOfBirth: new Date("1992-01-01") } })));
    const results = await Promise.allSettled(people.map((p) => appts.createAppointment(w.asAdminA, { patientId: p.id, doctorId: w.dA.id, ...t })));
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
  });

  it("patients cannot book for someone else", async () => {
    const a = await appts.createAppointment(w.asPatientA, { patientId: w.pB.id, doctorId: w.dA.id, ...slot(1200) });
    expect(a.patient.id).toBe(w.pA.id);
  });

  it("is idempotent for manual payments and refuses overpayment", async () => {
    const inv = await w.prisma.invoice.create({ data: { tenantId: w.A.id, number: `INV-P-${w.A.id.slice(0, 4)}`, patientId: w.pA.id, status: "PENDING", total: 100, createdById: w.asAdminA.userId } });
    const input = { mode: "manual" as const, invoiceId: inv.id, amount: 60, method: "CASH" as const, idempotencyKey: "key-12345678" };
    const first = await pay.createPayment(w.asAdminA, input);
    const replay = await pay.createPayment(w.asAdminA, input);
    expect(replay.replayed).toBe(true);
    expect(replay.payment.id).toBe(first.payment.id);
    const after = await w.prisma.invoice.findUniqueOrThrow({ where: { id: inv.id } });
    expect(after.amountPaid.toString()).toBe("60");
    expect(after.status).toBe("PARTIALLY_PAID");
    await expect(pay.createPayment(w.asAdminA, { ...input, amount: 41, idempotencyKey: "key-87654321" })).rejects.toMatchObject({ status: 400 });
    await pay.createPayment(w.asAdminA, { ...input, amount: 40, idempotencyKey: "key-abcdefgh" });
    expect((await w.prisma.invoice.findUniqueOrThrow({ where: { id: inv.id } })).status).toBe("PAID");
  });

  it("confirms an online payment only through a webhook, once", async () => {
    const inv = await w.prisma.invoice.create({ data: { tenantId: w.A.id, number: `INV-W-${w.A.id.slice(0, 4)}`, patientId: w.pA.id, status: "PENDING", total: 200, currency: "XOF", createdById: w.asAdminA.userId } });
    const p = await w.prisma.payment.create({ data: { tenantId: w.A.id, invoiceId: inv.id, amount: 200, method: "CARD", provider: "stripe", providerReference: `cs_${inv.id}`, idempotencyKey: `${w.A.id}:wh-${inv.id}`, status: "PENDING" } });
    expect((await w.prisma.invoice.findUniqueOrThrow({ where: { id: inv.id } })).amountPaid.toString()).toBe("0"); // pending does not count

    const event = { eventId: `evt_${inv.id}`, type: "succeeded" as const, providerReference: `cs_${inv.id}`, amountMinor: 200, currency: "XOF" };
    expect((await pay.applyPaymentEvent("stripe", event)).applied).toBe(true);
    expect((await pay.applyPaymentEvent("stripe", event)).applied).toBe(false); // duplicate delivery is a no-op
    expect((await w.prisma.payment.findUniqueOrThrow({ where: { id: p.id } })).status).toBe("SUCCEEDED");
    expect((await w.prisma.invoice.findUniqueOrThrow({ where: { id: inv.id } })).status).toBe("PAID");
  });

  it("fails a payment whose confirmed amount differs from the charge", async () => {
    const inv = await w.prisma.invoice.create({ data: { tenantId: w.A.id, number: `INV-M-${w.A.id.slice(0, 4)}`, patientId: w.pA.id, status: "PENDING", total: 300, currency: "XOF", createdById: w.asAdminA.userId } });
    const p = await w.prisma.payment.create({ data: { tenantId: w.A.id, invoiceId: inv.id, amount: 300, method: "CARD", provider: "stripe", providerReference: `cs_m_${inv.id}`, idempotencyKey: `${w.A.id}:m-${inv.id}`, status: "PENDING" } });
    await pay.applyPaymentEvent("stripe", { eventId: `evt_m_${inv.id}`, type: "succeeded", providerReference: `cs_m_${inv.id}`, amountMinor: 1 });
    expect((await w.prisma.payment.findUniqueOrThrow({ where: { id: p.id } })).status).toBe("FAILED");
    expect((await w.prisma.invoice.findUniqueOrThrow({ where: { id: inv.id } })).amountPaid.toString()).toBe("0");
  });
});
