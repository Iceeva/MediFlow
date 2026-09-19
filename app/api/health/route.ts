import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
  const started = Date.now();
  try {
    await prisma.$queryRaw`SELECT 1`;
    return NextResponse.json({ status: "ok", database: "up", latencyMs: Date.now() - started, time: new Date().toISOString() });
  } catch {
    return NextResponse.json({ status: "degraded", database: "down", latencyMs: Date.now() - started }, { status: 503 });
  }
}
