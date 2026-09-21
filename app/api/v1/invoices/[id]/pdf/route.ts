import { route } from "@/lib/api";
import { pdfResponse } from "@/lib/pdf";
import { renderInvoicePdf } from "@/services/invoice-pdf";

export const GET = route<{ id: string }>({ permission: "invoice:read", rateLimit: { limit: 60, windowSec: 600 } }, async ({ auth, params, audit }) => {
  const { bytes, fileName } = await renderInvoicePdf(auth, params.id);
  await audit("invoice.pdf", "invoice", params.id);
  return pdfResponse(bytes, fileName);
});
