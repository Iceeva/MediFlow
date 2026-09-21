import { DeleteObjectCommand, GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { env } from "@/lib/env";
import type { StorageProvider } from "./types";

let client: S3Client | undefined;

function s3() {
  const e = env();
  if (!e.S3_BUCKET || !e.S3_ACCESS_KEY_ID || !e.S3_SECRET_ACCESS_KEY) throw new Error("S3 storage is not fully configured");
  return (client ??= new S3Client({
    region: e.S3_REGION,
    endpoint: e.S3_ENDPOINT || undefined, // set for Cloudflare R2 or any S3-compatible service
    forcePathStyle: !!e.S3_ENDPOINT,
    credentials: { accessKeyId: e.S3_ACCESS_KEY_ID, secretAccessKey: e.S3_SECRET_ACCESS_KEY },
  }));
}

/** The bucket MUST stay private (block public access). Objects are only read by this server. */
export const s3Provider: StorageProvider = {
  name: "s3",
  async put({ key, body, mimeType }) {
    await s3().send(new PutObjectCommand({ Bucket: env().S3_BUCKET, Key: key, Body: body, ContentType: mimeType }));
    return { storageKey: key };
  },
  async get(storageKey) {
    const res = await s3().send(new GetObjectCommand({ Bucket: env().S3_BUCKET, Key: storageKey }));
    if (!res.Body) throw new Error("Empty S3 response");
    return Buffer.from(await res.Body.transformToByteArray());
  },
  async remove(storageKey) {
    await s3().send(new DeleteObjectCommand({ Bucket: env().S3_BUCKET, Key: storageKey }));
  },
};
