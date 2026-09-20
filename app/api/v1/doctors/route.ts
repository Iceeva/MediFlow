import { z } from "zod";
import { route } from "@/lib/api";
import { paged, paginationSchema, parseQuery } from "@/lib/http";
import { listDoctors } from "@/services/doctor.service";

const querySchema = paginationSchema.extend({ specialization: z.string().max(80).optional() });

// Doctors are created through POST /users with role DOCTOR (one account, one profile, one invitation email).
export const GET = route({ permission: "doctor:read" }, async ({ auth, query }) => {
  const p = parseQuery(query, querySchema);
  const { items, total } = await listDoctors(auth, p, p.specialization);
  return paged(items, total, p);
});
