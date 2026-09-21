/** Low-level object store. Implementations: Vercel Blob, S3 / Cloudflare R2. */
export interface StorageProvider {
  readonly name: "blob" | "s3";
  put(input: { key: string; body: Buffer; mimeType: string }): Promise<{ storageKey: string }>;
  get(storageKey: string): Promise<Buffer>;
  remove(storageKey: string): Promise<void>;
}

export interface StoredFile {
  storageKey: string;
  provider: "blob" | "s3";
  size: number;
  mimeType: string;
}

/**
 * What the rest of the application depends on. No route or service imports a provider SDK directly,
 * so switching Vercel Blob / S3 / R2 is a configuration change (STORAGE_PROVIDER).
 */
export interface StorageService {
  upload(input: { scope: string; fileName: string; mimeType: string; body: Buffer }): Promise<StoredFile>;
  download(storageKey: string): Promise<Buffer>;
  getSignedUrl(input: { documentId: string; userId: string; ttlSec?: number }): { url: string; expiresAt: Date };
  delete(storageKey: string): Promise<void>;
}
