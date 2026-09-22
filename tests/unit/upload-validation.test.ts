import { describe, expect, it } from "vitest";
import { detectMime, MAX_UPLOAD_BYTES, sanitizeFileName } from "@/lib/storage/validate";

const pdf = Buffer.from("%PDF-1.7\n...");
const png = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(16)]);

describe("upload validation", () => {
  it("detects type from content", () => {
    expect(detectMime(pdf, "report.pdf", "application/pdf")).toBe("application/pdf");
    expect(detectMime(png, "scan.png", "image/png")).toBe("image/png");
  });

  it("rejects an executable renamed to .pdf", () => {
    expect(() => detectMime(Buffer.from("MZ\x90\x00 fake exe"), "malware.pdf", "application/pdf")).toThrow(/Unsupported/);
  });

  it("rejects extension and declared type mismatches", () => {
    expect(() => detectMime(pdf, "x.png", "application/pdf")).toThrow(/extension/);
    expect(() => detectMime(pdf, "x.pdf", "image/png")).toThrow(/declared/);
  });

  it("enforces size and non-empty files", () => {
    expect(() => detectMime(Buffer.alloc(0), "x.pdf", "")).toThrow(/empty/);
    expect(() => detectMime(Buffer.concat([pdf, Buffer.alloc(MAX_UPLOAD_BYTES)]), "x.pdf", "")).toThrow(/exceeds/);
  });

  it("sanitizes file names", () => {
    expect(sanitizeFileName('../../etc/pass"wd\n.pdf')).not.toMatch(/[\\/"\n]/);
    expect(sanitizeFileName("   ")).toBe("document");
  });
});
