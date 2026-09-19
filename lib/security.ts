import bcrypt from "bcryptjs";
import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";

const BCRYPT_ROUNDS = 12;

export const hashPassword = (plain: string) => bcrypt.hash(plain, BCRYPT_ROUNDS);
export const verifyPassword = (plain: string, hash: string) => bcrypt.compare(plain, hash);

// Used to keep login timing similar when the account does not exist.
export const DUMMY_HASH = "$2a$12$C6UzMDM.H6dfI/f/IKcEeO5fU6xX1u3m4o3kZk1q3q4l6w0pZxk9G";

export const randomToken = (bytes = 32) => randomBytes(bytes).toString("base64url");
export const sha256 = (v: string) => createHash("sha256").update(v).digest("hex");

export function hmac(secret: string, payload: string) {
  return createHmac("sha256", secret).update(payload).digest("base64url");
}

export function safeEqual(a: string, b: string) {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  return ab.length === bb.length && timingSafeEqual(ab, bb);
}
