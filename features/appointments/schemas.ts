import { z } from "zod";

export const APPOINTMENT_STATUSES = ["PENDING", "CONFIRMED", "CHECKED_IN", "IN_PROGRESS", "COMPLETED", "CANCELLED", "NO_SHOW"] as const;
export type AppointmentStatusValue = (typeof APPOINTMENT_STATUSES)[number];

/** Allowed status transitions. Terminal states have no outgoing edge. */
export const TRANSITIONS: Record<AppointmentStatusValue, readonly AppointmentStatusValue[]> = {
  PENDING: ["CONFIRMED", "CANCELLED"],
  CONFIRMED: ["CHECKED_IN", "CANCELLED", "NO_SHOW"],
  CHECKED_IN: ["IN_PROGRESS", "CANCELLED", "NO_SHOW"],
  IN_PROGRESS: ["COMPLETED"],
  COMPLETED: [],
  CANCELLED: [],
  NO_SHOW: [],
};

const slot = z
  .object({ startsAt: z.coerce.date(), endsAt: z.coerce.date() })
  .refine((v) => v.endsAt > v.startsAt, { message: "End must be after start", path: ["endsAt"] })
  .refine((v) => v.endsAt.getTime() - v.startsAt.getTime() <= 4 * 3_600_000, { message: "An appointment cannot exceed 4 hours", path: ["endsAt"] });

export const createAppointmentSchema = z
  .object({
    patientId: z.string().uuid().optional(), // ignored for patients: they always book for themselves
    doctorId: z.string().uuid(),
    startsAt: z.coerce.date(),
    endsAt: z.coerce.date(),
    reason: z.string().trim().max(300).optional(),
    notes: z.string().trim().max(5000).optional(),
  })
  .and(slot)
  .refine((v) => v.startsAt.getTime() > Date.now() - 60_000, { message: "Start must be in the future", path: ["startsAt"] });

export const updateAppointmentSchema = z
  .object({
    status: z.enum(APPOINTMENT_STATUSES).optional(),
    startsAt: z.coerce.date().optional(),
    endsAt: z.coerce.date().optional(),
    reason: z.string().trim().max(300).optional(),
    notes: z.string().trim().max(5000).optional(),
  })
  .refine((v) => (v.startsAt && v.endsAt) || (!v.startsAt && !v.endsAt), { message: "Provide both startsAt and endsAt to reschedule", path: ["endsAt"] });

export const listAppointmentsSchema = z.object({
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
  doctorId: z.string().uuid().optional(),
  patientId: z.string().uuid().optional(),
  status: z.enum(APPOINTMENT_STATUSES).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(500).default(20),
  order: z.enum(["asc", "desc"]).default("asc"),
});
