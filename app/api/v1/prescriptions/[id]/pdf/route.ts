import { route } from "@/lib/api";
import { pdfResponse } from "@/lib/pdf";
import { renderPrescriptionPdf } from "@/services/prescription-pdf";

export const GET = route<{ id: string }>({ permission: "prescription:read", rateLimit: { limit: 60, windowSec: 600 } }, async ({ auth, params, audit }) => {
  const { bytes, fileName } = await renderPrescriptionPdf(auth, params.id);
  await audit("prescription.pdf", "prescription", params.id);
  return pdfResponse(bytes, fileName);
});
