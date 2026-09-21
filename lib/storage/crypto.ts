import { createCipheriv, createDecipheriv, hkdfSync, randomBytes } from "node:crypto";
import { env } from "@/lib/env";

// Application-level AES-256-GCM, used for stores that cannot guarantee private objects (Vercel Blob URLs are
// unguessable but public). Layout: iv (12) | auth tag (16) | ciphertext.
const key = () => Buffer.from(hkdfSync("sha256", env().AUTH_SECRET, "mediflow", "storage-v1", 32));

export function encrypt(plain: Buffer): Buffer {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(), iv);
  const body = Buffer.concat([cipher.update(plain), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), body]);
}

export function decrypt(blob: Buffer): Buffer {
  const iv = blob.subarray(0, 12);
  const tag = blob.subarray(12, 28);
  const decipher = createDecipheriv("aes-256-gcm", key(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(blob.subarray(28)), decipher.final()]);
}
