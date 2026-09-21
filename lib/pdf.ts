import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";

// Standard PDF fonts only cover WinAnsi (Latin-1). Replace anything else instead of crashing.
const clean = (s: string) => s.replace(/[^\x09\x0A\x0D\x20-\x7E\xA0-\xFF]/g, "?");

const INK = rgb(0.07, 0.15, 0.23);
const MUTED = rgb(0.42, 0.48, 0.54);
const ACCENT = rgb(0.05, 0.49, 0.53);
const LINE = rgb(0.82, 0.86, 0.88);

export class PdfBuilder {
  private constructor(private doc: PDFDocument, private font: PDFFont, private bold: PDFFont, private page: PDFPage, public y: number) {}

  static readonly W = 595.28;
  static readonly H = 841.89;
  static readonly M = 48;

  static async create() {
    const doc = await PDFDocument.create();
    const font = await doc.embedFont(StandardFonts.Helvetica);
    const bold = await doc.embedFont(StandardFonts.HelveticaBold);
    const page = doc.addPage([PdfBuilder.W, PdfBuilder.H]);
    return new PdfBuilder(doc, font, bold, page, PdfBuilder.H - PdfBuilder.M);
  }

  private ensure(h: number) {
    if (this.y - h < PdfBuilder.M + 30) {
      this.page = this.doc.addPage([PdfBuilder.W, PdfBuilder.H]);
      this.y = PdfBuilder.H - PdfBuilder.M;
    }
  }

  header(clinic: string, title: string, subtitle: string) {
    this.page.drawRectangle({ x: 0, y: PdfBuilder.H - 8, width: PdfBuilder.W, height: 8, color: ACCENT });
    this.text(clinic, { size: 11, bold: true, color: ACCENT });
    this.y -= 6;
    this.text(title, { size: 22, bold: true });
    this.text(subtitle, { size: 10, color: MUTED });
    this.rule();
  }

  text(s: string, o: { size?: number; bold?: boolean; color?: ReturnType<typeof rgb>; x?: number; maxWidth?: number } = {}) {
    const size = o.size ?? 10;
    const font = o.bold ? this.bold : this.font;
    const x = o.x ?? PdfBuilder.M;
    const maxWidth = o.maxWidth ?? PdfBuilder.W - PdfBuilder.M - x;
    for (const line of this.wrap(clean(s), font, size, maxWidth)) {
      this.ensure(size + 4);
      this.page.drawText(line, { x, y: this.y - size, size, font, color: o.color ?? INK });
      this.y -= size + 4;
    }
  }

  kv(label: string, value: string, x = PdfBuilder.M) {
    this.text(label, { size: 8, color: MUTED, x });
    this.text(value || "-", { size: 11, x });
    this.y -= 2;
  }

  rule() {
    this.y -= 4;
    this.page.drawLine({ start: { x: PdfBuilder.M, y: this.y }, end: { x: PdfBuilder.W - PdfBuilder.M, y: this.y }, thickness: 0.6, color: LINE });
    this.y -= 10;
  }

  row(cells: { t: string; w: number; bold?: boolean; align?: "left" | "right" }[], size = 10) {
    this.ensure(size + 10);
    let x = PdfBuilder.M;
    let lowest = this.y;
    const top = this.y;
    for (const c of cells) {
      this.y = top;
      const font = c.bold ? this.bold : this.font;
      const lines = this.wrap(clean(c.t), font, size, c.w - 8);
      for (const line of lines) {
        const dx = c.align === "right" ? c.w - 8 - font.widthOfTextAtSize(line, size) : 0;
        this.page.drawText(line, { x: x + dx, y: this.y - size, size, font, color: INK });
        this.y -= size + 3;
      }
      lowest = Math.min(lowest, this.y);
      x += c.w;
    }
    this.y = lowest - 3;
  }

  signatureBox(label: string) {
    this.ensure(70);
    this.y -= 24;
    this.page.drawLine({ start: { x: PdfBuilder.W - PdfBuilder.M - 200, y: this.y }, end: { x: PdfBuilder.W - PdfBuilder.M, y: this.y }, thickness: 0.8, color: INK });
    this.y -= 12;
    this.text(label, { size: 9, color: MUTED, x: PdfBuilder.W - PdfBuilder.M - 200 });
  }

  private wrap(s: string, font: PDFFont, size: number, maxWidth: number) {
    const out: string[] = [];
    for (const para of s.split(/\r?\n/)) {
      let line = "";
      for (const word of para.split(/\s+/)) {
        const t = line ? `${line} ${word}` : word;
        if (font.widthOfTextAtSize(t, size) <= maxWidth || !line) line = t;
        else { out.push(line); line = word; }
      }
      out.push(line);
    }
    return out;
  }

  async finish(footer: string) {
    const pages = this.doc.getPages();
    pages.forEach((p, i) => p.drawText(clean(`${footer}  -  page ${i + 1} of ${pages.length}`), { x: PdfBuilder.M, y: 24, size: 8, font: this.font, color: MUTED }));
    return this.doc.save();
  }
}

export const pdfResponse = (bytes: Uint8Array, fileName: string) =>
  new Response(Buffer.from(bytes), { headers: { "Content-Type": "application/pdf", "Content-Disposition": `attachment; filename="${fileName}"`, "Cache-Control": "no-store" } });
