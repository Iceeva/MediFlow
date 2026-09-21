import { del, put } from "@vercel/blob";
import { env } from "@/lib/env";
import { decrypt, encrypt } from "./crypto";
import type { StorageProvider } from "./types";

/**
 * Vercel Blob provider. The stored object is ciphertext (see crypto.ts) with a random path suffix, and the
 * blob URL (kept in `storageKey`) is never sent to clients: downloads always go through the authorized API route.
 */
export const blobProvider: StorageProvider = {
  name: "blob",
  async put({ key, body }) {
    const token = env().BLOB_READ_WRITE_TOKEN;
    if (!token) throw new Error("BLOB_READ_WRITE_TOKEN is not configured");
    const res = await put(key, encrypt(body), { access: "public", addRandomSuffix: true, contentType: "application/octet-stream", token });
    return { storageKey: res.url };
  },
  async get(storageKey) {
    const res = await fetch(storageKey, { cache: "no-store" });
    if (!res.ok) throw new Error(`Blob fetch failed (${res.status})`);
    return decrypt(Buffer.from(await res.arrayBuffer()));
  },
  async remove(storageKey) {
    await del(storageKey, { token: env().BLOB_READ_WRITE_TOKEN });
  },
};
