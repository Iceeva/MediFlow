import { NextResponse } from "next/server";
import { publicRoute } from "@/lib/api";
import { env } from "@/lib/env";
import { safeEqual } from "@/lib/security";
import { unauthorized } from "@/lib/errors";
import { runDailyJobs } from "@/services/reminders.service";

export const maxDuration = 60;

// Vercel Cron calls this with `Authorization: Bearer $CRON_SECRET`. Without the secret it is closed.
export const GET = publicRoute({ csrf: false }, async ({ req }) => {
  const secret = env().CRON_SECRET;
  const given = req.headers.get("authorization") ?? "";
  if (!secret || !safeEqual(given, `Bearer ${secret}`)) throw unauthorized("Invalid cron credentials");
  return NextResponse.json({ data: await runDailyJobs() });
});
