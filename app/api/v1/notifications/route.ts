import { z } from "zod";
import { route } from "@/lib/api";
import { ok, paginationSchema, parseQuery } from "@/lib/http";
import { listNotifications, markAllRead } from "@/services/notification.service";

const querySchema = paginationSchema.extend({ unread: z.enum(["true", "false"]).optional() });

export const GET = route({ permission: "notification:read" }, async ({ auth, query }) => {
  const p = parseQuery(query, querySchema);
  const { items, total, unread } = await listNotifications(auth, p, p.unread === "true");
  return ok(items, { meta: { page: p.page, pageSize: p.pageSize, total, totalPages: Math.max(1, Math.ceil(total / p.pageSize)), unread } });
});

export const POST = route({ permission: "notification:read" }, async ({ auth }) => {
  const res = await markAllRead(auth);
  return ok({ updated: res.count });
});
