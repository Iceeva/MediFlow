import { z } from "zod";
import { route } from "@/lib/api";
import { ok, parseBody } from "@/lib/http";
import { markRead } from "@/services/notification.service";

export const PATCH = route<{ id: string }>({ permission: "notification:read" }, async ({ req, auth, params }) => {
  const { read } = await parseBody(req, z.object({ read: z.boolean() }));
  await markRead(auth, params.id, read);
  return ok({ id: params.id, read });
});
