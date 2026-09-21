import { prisma } from "@/lib/prisma";
import { PdfBuilder } from "@/lib/pdf";
import { requireTenantId } from "@/lib/tenant";
import type { AuthContext } from "@/lib/session";
import { getPrescription } from "./prescription.service";

export async function renderPrescriptionPdf(auth: AuthContext, id: string) {
  const rx = await getPrescription(auth, id); // enforces tenant and role scope
  const tenant = await prisma.tenant.findUniqueOrThrow({ where: { id: requireTenantId(auth) }, select: { name: true, address: true, phone: true } });
  const pdf = await PdfBuilder.create();
  pdf.header(tenant.name, "Prescription", `${rx.number}  -  issued ${rx.issuedAt.toISOString().slice(0, 10)}`);

  const half = (PdfBuilder.W - PdfBuilder.M * 2) / 2;
  const top = pdf.y;
  pdf.kv("Patient", `${rx.patient.firstName} ${rx.patient.lastName}`);
  pdf.kv("Date of birth", rx.patient.dateOfBirth.toISOString().slice(0, 10));
  const left = pdf.y;
  pdf.y = top;
  pdf.kv("Prescribing doctor", `Dr ${rx.doctor.user.firstName} ${rx.doctor.user.lastName}`, PdfBuilder.M + half);
  pdf.kv("Specialization / license", `${rx.doctor.specialization} / ${rx.doctor.licenseNumber}`, PdfBuilder.M + half);
  pdf.y = Math.min(left, pdf.y);
  pdf.rule();

  const cols = [{ t: "Medication", w: 170, bold: true }, { t: "Dosage", w: 70, bold: true }, { t: "Frequency", w: 100, bold: true }, { t: "Duration", w: 70, bold: true }, { t: "Route", w: 38, bold: true }];
  pdf.row(cols);
  pdf.rule();
  for (const i of rx.items) {
    pdf.row([{ t: i.medicationName, w: 170 }, { t: i.dosage, w: 70 }, { t: i.frequency, w: 100 }, { t: i.duration, w: 70 }, { t: i.route ?? "-", w: 38 }]);
    if (i.instructions) pdf.text(`Instructions: ${i.instructions}`, { size: 9, x: PdfBuilder.M + 12 });
    pdf.y -= 4;
  }
  if (rx.notes) { pdf.rule(); pdf.text("Notes", { bold: true, size: 9 }); pdf.text(rx.notes); }
  pdf.signatureBox(`Dr ${rx.doctor.user.firstName} ${rx.doctor.user.lastName} - signature`);
  return { bytes: await pdf.finish(`${tenant.name}  -  ${rx.number}`), fileName: `${rx.number}.pdf` };
}
