import { describe, expect, it } from "vitest";
import { signDownload, verifyDownload } from "@/lib/storage/signed-url";

const token = (url: string) => decodeURIComponent(new URL(url, "http://x").searchParams.get("token")!);

describe("signed download links", () => {
  it("verifies for the same document and user before expiry", () => {
    const { url } = signDownload("doc-1", "user-1", 60);
    expect(verifyDownload(token(url), "doc-1", "user-1")).toBe(true);
  });

  it("is bound to the user and the document", () => {
    const t = token(signDownload("doc-1", "user-1", 60).url);
    expect(verifyDownload(t, "doc-1", "user-2")).toBe(false);
    expect(verifyDownload(t, "doc-2", "user-1")).toBe(false);
  });

  it("expires", () => {
    const t = token(signDownload("doc-1", "user-1", 60).url);
    expect(verifyDownload(t, "doc-1", "user-1", Date.now() + 61_000)).toBe(false);
  });

  it("rejects tampering and garbage", () => {
    const t = token(signDownload("doc-1", "user-1", 60).url);
    const [d, u, e, s] = t.split(".");
    expect(verifyDownload(`${d}.${u}.${Number(e) + 999}.${s}`, "doc-1", "user-1")).toBe(false);
    expect(verifyDownload("nonsense", "doc-1", "user-1")).toBe(false);
  });
});
