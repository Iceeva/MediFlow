import { z } from "zod";
import { route } from "@/lib/api";
import { ok, parseQuery } from "@/lib/http";
import { globalSearch } from "@/services/search.service";

export const GET = route({ permission: "search:use", rateLimit: { limit: 120, windowSec: 60 } }, async ({ auth, query }) => {
  const { q } = parseQuery(query, z.object({ q: z.string().trim().min(2).max(80) }));
  return ok(await globalSearch(auth, q));
});
