import { env } from "@/lib/env";
import { hmac, safeEqual } from "@/lib/security";

/**
 * Temporary signed download link: documentId.userId.expiry.signature.
 * It is bound to one document AND one user, expires quickly, and the download route additionally requires
 * the user's session plus a fresh authorization check, so a leaked link alone is useless.
 */
export function signDownload(documentId: string, userId: string, ttlSec: number) {
  const exp = Math.floor(Date.now() / 1000) + ttlSec;
  const payload = `${documentId}.${userId}.${exp}`;
  const token = `${payload}.${hmac(env().AUTH_SECRET, `download:${payload}`)}`;
  return { url: `/api/v1/documents/${documentId}/download?token=${encodeURIComponent(token)}`, expiresAt: new Date(exp * 1000) };
}

export function verifyDownload(token: string, documentId: string, userId: string, now = Date.now()) {
  const [doc, user, exp, sig] = token.split(".");
  if (!doc || !user || !exp || !sig) return false;
  const expected = hmac(env().AUTH_SECRET, `download:${doc}.${user}.${exp}`);
  return safeEqual(sig, expected) && doc === documentId && user === userId && Number(exp) * 1000 > now;
}
