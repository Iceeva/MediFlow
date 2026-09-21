import { badRequest } from "@/lib/errors";

export const MAX_UPLOAD_BYTES = 4 * 1024 * 1024; // Vercel serverless request bodies are capped at 4.5 MB

const SIGNATURES: { mime: string; ext: string[]; test: (b: Buffer) => boolean }[] = [
  { mime: "application/pdf", ext: [".pdf"], test: (b) => b.subarray(0, 5).toString("latin1") === "%PDF-" },
  { mime: "image/png", ext: [".png"], test: (b) => b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) },
  { mime: "image/jpeg", ext: [".jpg", ".jpeg"], test: (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff },
  { mime: "image/webp", ext: [".webp"], test: (b) => b.subarray(0, 4).toString("latin1") === "RIFF" && b.subarray(8, 12).toString("latin1") === "WEBP" },
];

/** Trusts the file CONTENT (magic bytes), never the declared Content-Type or extension alone. */
export function detectMime(body: Buffer, fileName: string, declared: string): string {
  if (body.length === 0) throw badRequest("The file is empty");
  if (body.length > MAX_UPLOAD_BYTES) throw badRequest(`The file exceeds ${MAX_UPLOAD_BYTES / 1024 / 1024} MB`);
  const sig = SIGNATURES.find((s) => s.test(body));
  if (!sig) throw badRequest("Unsupported file type. Allowed: PDF, PNG, JPEG, WebP");
  const ext = /\.[a-z0-9]+$/i.exec(fileName)?.[0]?.toLowerCase();
  if (ext && !sig.ext.includes(ext)) throw badRequest("The file extension does not match its content");
  if (declared && declared !== sig.mime && declared !== "application/octet-stream") throw badRequest("The declared file type does not match its content");
  return sig.mime;
}

export const sanitizeFileName = (name: string) =>
  name.replace(/[\\/\0\r\n"]/g, "_").replace(/\s+/g, " ").trim().slice(0, 120) || "document";

// TODO (NOT IMPLEMENTED): antivirus scanning. Plug a scanner (e.g. ClamAV service or a provider API)
// here and reject the upload when it reports a threat. See README, "Documents" section.
