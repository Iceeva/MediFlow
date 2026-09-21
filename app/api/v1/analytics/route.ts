import { route } from "@/lib/api";
import { ok } from "@/lib/http";
import { dashboardFor } from "@/services/analytics.service";

// All figures come from PostgreSQL through Prisma, filtered by the role and tenant of the session.
export const GET = route({}, async ({ auth }) => ok(await dashboardFor(auth)));
