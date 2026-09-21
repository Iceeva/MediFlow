import { randomUUID } from "node:crypto";
import { env } from "@/lib/env";
import { blobProvider } from "./blob";
import { s3Provider } from "./s3";
import { signDownload } from "./signed-url";
import type { StorageProvider, StorageService } from "./types";

export type { StorageService, StoredFile } from "./types";

function provider(): StorageProvider {
  return env().STORAGE_PROVIDER === "s3" ? s3Provider : blobProvider;
}

const safeExt = (name: string) => (/\.[a-z0-9]{1,8}$/i.exec(name)?.[0] ?? "").toLowerCase();

export const storage: StorageService = {
  async upload({ scope, fileName, mimeType, body }) {
    const p = provider();
    const { storageKey } = await p.put({ key: `${scope}/${randomUUID()}${safeExt(fileName)}`, body, mimeType });
    return { storageKey, provider: p.name, size: body.length, mimeType };
  },
  download: (storageKey) => provider().get(storageKey),
  getSignedUrl: ({ documentId, userId, ttlSec = 120 }) => signDownload(documentId, userId, ttlSec),
  delete: (storageKey) => provider().remove(storageKey),
};
