import { route } from "@/lib/api";
import { getPatient, patientTimeline } from "@/services/patient.service";

// Controlled export: authorized roles only, rate limited, always audited, served as an attachment.
export const GET = route<{ id: string }>({ permission: "patient:clinical", rateLimit: { limit: 10, windowSec: 3600 } }, async ({ auth, params, audit }) => {
  const [patient, timeline] = await Promise.all([getPatient(auth, params.id), patientTimeline(auth, params.id)]);
  await audit("patient.export", "patient", params.id);
  return new Response(JSON.stringify({ exportedAt: new Date().toISOString(), patient, ...timeline }, null, 2), {
    headers: { "Content-Type": "application/json", "Content-Disposition": `attachment; filename="patient-${params.id}.json"`, "Cache-Control": "no-store" },
  });
});
