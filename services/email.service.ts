import { env } from "@/lib/env";
import { logger } from "@/lib/logger";

export interface EmailMessage {
  to: string;
  subject: string;
  html: string;
}

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

/**
 * Sends through the Resend HTTP API (no queue, no SMTP socket: serverless friendly).
 * Without EMAIL_API_KEY nothing is sent and a warning is logged (no message body is logged).
 */
export async function sendEmail(msg: EmailMessage): Promise<boolean> {
  const { EMAIL_API_KEY, EMAIL_FROM } = env();
  if (!EMAIL_API_KEY) {
    logger.warn("email_not_configured", { subject: msg.subject });
    return false;
  }
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${EMAIL_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: EMAIL_FROM, to: msg.to, subject: msg.subject, html: msg.html }),
    });
    if (!res.ok) logger.error("email_send_failed", { status: res.status });
    return res.ok;
  } catch (e) {
    logger.error("email_send_error", { error: e instanceof Error ? e.message : "unknown" });
    return false;
  }
}

const link = (path: string, token: string) => `${env().NEXT_PUBLIC_APP_URL}${path}?token=${encodeURIComponent(token)}`;

export const sendVerificationEmail = (to: string, name: string, token: string) =>
  sendEmail({
    to,
    subject: "Verify your MediFlow email address",
    html: `<p>Hello ${esc(name)},</p><p>Confirm your email address to finish setting up your account:</p><p><a href="${link("/verify-email", token)}">Verify email</a></p><p>This link expires in 24 hours.</p>`,
  });

export const sendPasswordResetEmail = (to: string, name: string, token: string) =>
  sendEmail({
    to,
    subject: "Reset your MediFlow password",
    html: `<p>Hello ${esc(name)},</p><p>Use the link below to choose a new password:</p><p><a href="${link("/reset-password", token)}">Reset password</a></p><p>This link expires in 1 hour. If you did not ask for it, ignore this email.</p>`,
  });

export const sendAppointmentReminderEmail = (to: string, name: string, whenLabel: string, doctor: string) =>
  sendEmail({
    to,
    subject: "Appointment reminder",
    html: `<p>Hello ${esc(name)},</p><p>This is a reminder of your appointment with ${esc(doctor)} on ${esc(whenLabel)}.</p>`,
  });
