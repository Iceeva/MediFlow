import { describe, expect, it } from "vitest";
import { PdfBuilder } from "@/lib/pdf";

describe("PDF builder", () => {
  it("produces a valid PDF and survives non Latin-1 characters", async () => {
    const pdf = await PdfBuilder.create();
    pdf.header("Demo Clinic", "Prescription", "RX-2026-00001");
    pdf.text("Patient: Zoë 患者 \u2603");
    for (let i = 0; i < 80; i++) pdf.row([{ t: `Line ${i}`, w: 200 }, { t: "x", w: 100 }]); // forces a page break
    const bytes = await pdf.finish("footer");
    expect(Buffer.from(bytes.subarray(0, 5)).toString()).toBe("%PDF-");
    expect(bytes.length).toBeGreaterThan(1000);
  });
});
