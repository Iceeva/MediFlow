import { z } from "zod";

export const passwordSchema = z
  .string()
  .min(10, "At least 10 characters")
  .max(128)
  .regex(/[a-z]/, "Add a lowercase letter")
  .regex(/[A-Z]/, "Add an uppercase letter")
  .regex(/[0-9]/, "Add a digit");

const person = {
  email: z.string().trim().toLowerCase().email().max(254),
  password: passwordSchema,
  firstName: z.string().trim().min(1).max(80),
  lastName: z.string().trim().min(1).max(80),
};

export const registerSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("clinic"),
    ...person,
    clinicName: z.string().trim().min(2).max(120),
    clinicSlug: z.string().trim().toLowerCase().regex(/^[a-z0-9-]{3,40}$/, "3-40 lowercase letters, digits or dashes"),
  }),
  z.object({
    type: z.literal("patient"),
    ...person,
    clinicSlug: z.string().trim().toLowerCase().min(3).max(40),
    dateOfBirth: z.coerce.date(),
  }),
]);

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(1).max(128),
  clinicSlug: z.string().trim().toLowerCase().optional(),
});

export const forgotSchema = z.object({ email: z.string().trim().toLowerCase().email() });
export const resetSchema = z.object({ token: z.string().min(20).max(200), password: passwordSchema });
export const verifySchema = z.object({ token: z.string().min(20).max(200) });
export const changePasswordSchema = z.object({ currentPassword: z.string().min(1).max(128), newPassword: passwordSchema });

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
