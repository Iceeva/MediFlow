import { Prisma } from "@prisma/client";
import { ZodError } from "zod";
import { describe, expect, it } from "vitest";
import { registerSchema, passwordSchema } from "@/features/auth/schemas";
import { createAppointmentSchema, TRANSITIONS } from "@/features/appointments/schemas";
import { createPaymentSchema } from "@/features/payments/schemas";
import { availabilitySchema } from "@/features/doctors/schemas";
import { createPrescriptionSchema } from "@/features/prescriptions/schemas";
import { orderBy, pageArgs, paginationSchema } from "@/lib/http";
import { toResponse } from "@/lib/api";
import { ApiError } from "@/lib/errors";
import { localParts } from "@/lib/time";

const uuid = "11111111-1111-4111-8111-111111111111";

describe("auth schemas", () => {
  it("enforces the password policy", () => {
    expect(passwordSchema.safeParse("short1A").success).toBe(false);
    expect(passwordSchema.safeParse("alllowercase123").success).toBe(false);
    expect(passwordSchema.safeParse("GoodPassword42").success).toBe(true);
  });
  it("normalizes email and validates the clinic slug", () => {
    const r = registerSchema.parse({ type: "clinic", email: " A@B.COM ", password: "GoodPassword42", firstName: "A", lastName: "B", clinicName: "Clinic", clinicSlug: "my-clinic" });
    expect(r.email).toBe("a@b.com");
    expect(registerSchema.safeParse({ type: "clinic", email: "a@b.com", password: "GoodPassword42", firstName: "A", lastName: "B", clinicName: "C", clinicSlug: "Bad Slug!" }).success).toBe(false);
  });
});

describe("appointment schemas", () => {
  const future = new Date(Date.now() + 86_400_000);
  it("requires end after start and caps the duration", () => {
    const base = { doctorId: uuid, startsAt: future };
    expect(createAppointmentSchema.safeParse({ ...base, endsAt: new Date(future.getTime() - 1) }).success).toBe(false);
    expect(createAppointmentSchema.safeParse({ ...base, endsAt: new Date(future.getTime() + 5 * 3_600_000) }).success).toBe(false);
    expect(createAppointmentSchema.safeParse({ ...base, endsAt: new Date(future.getTime() + 1_800_000) }).success).toBe(true);
  });
  it("terminal statuses have no transitions", () => {
    expect(TRANSITIONS.COMPLETED).toHaveLength(0);
    expect(TRANSITIONS.CANCELLED).toHaveLength(0);
    expect(TRANSITIONS.PENDING).toContain("CONFIRMED");
    expect(TRANSITIONS.PENDING).not.toContain("COMPLETED");
  });
});

describe("payments, availability, prescriptions", () => {
  it("never accepts a client supplied amount for online payments", () => {
    const r = createPaymentSchema.parse({ mode: "online", invoiceId: uuid, provider: "stripe", amount: 1 });
    expect("amount" in r).toBe(false);
  });
  it("rejects non positive manual amounts", () => {
    expect(createPaymentSchema.safeParse({ mode: "manual", invoiceId: uuid, amount: 0, method: "CASH" }).success).toBe(false);
  });
  it("validates agenda slots", () => {
    expect(availabilitySchema.safeParse({ slots: [{ dayOfWeek: 1, startTime: "09:00", endTime: "08:00" }] }).success).toBe(false);
    expect(availabilitySchema.safeParse({ slots: [{ dayOfWeek: 1, startTime: "08:00", endTime: "12:00" }] }).success).toBe(true);
  });
  it("needs at least one prescription item", () => {
    expect(createPrescriptionSchema.safeParse({ patientId: uuid, items: [] }).success).toBe(false);
  });
});

describe("http helpers", () => {
  it("paginates and whitelists sorting", () => {
    const p = paginationSchema.parse({ page: "3", pageSize: "10", sortBy: "passwordHash" });
    expect(pageArgs(p)).toEqual({ skip: 20, take: 10 });
    expect(orderBy(p, ["lastName", "createdAt"] as const, "lastName")).toEqual({ lastName: "desc" });
    expect(paginationSchema.safeParse({ pageSize: "1000" }).success).toBe(false);
  });

  it("maps errors to consistent responses", async () => {
    const forbidden = toResponse(new ApiError(403, "FORBIDDEN", "no"));
    expect(forbidden.status).toBe(403);
    expect((await forbidden.json()).error.code).toBe("FORBIDDEN");

    const zod = toResponse(new ZodError([{ code: "custom", path: ["x"], message: "bad" }]));
    expect(zod.status).toBe(422);

    const dup = toResponse(new Prisma.PrismaClientKnownRequestError("dup", { code: "P2002", clientVersion: "test" }));
    expect(dup.status).toBe(409);

    const unknown = toResponse(new Error("secret internal detail"));
    expect(unknown.status).toBe(500);
    expect(JSON.stringify(await unknown.json())).not.toContain("secret internal detail");
  });

  it("reads the local weekday and time in a time zone", () => {
    const d = new Date("2026-09-21T08:30:00Z"); // Monday
    expect(localParts(d, "UTC")).toEqual({ dayOfWeek: 1, time: "08:30" });
    expect(localParts(d, "Africa/Porto-Novo")).toEqual({ dayOfWeek: 1, time: "09:30" });
  });
});
