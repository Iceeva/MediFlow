import { NextResponse } from "next/server";
import { z } from "zod";
import { ApiError, badRequest } from "./errors";

export function ok<T>(data: T, init?: { status?: number; meta?: Record<string, unknown> }) {
  return NextResponse.json({ data, ...(init?.meta ? { meta: init.meta } : {}) }, { status: init?.status ?? 200 });
}

export const created = <T>(data: T) => ok(data, { status: 201 });

export function errorResponse(e: ApiError) {
  const headers: Record<string, string> = {};
  if (e.status === 429 && e.details && typeof e.details === "object" && "retryAfterSec" in e.details) {
    headers["Retry-After"] = String((e.details as { retryAfterSec: number }).retryAfterSec);
  }
  return NextResponse.json({ error: { code: e.code, message: e.message, ...(e.details ? { details: e.details } : {}) } }, { status: e.status, headers });
}

export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  sortBy: z.string().max(40).optional(),
  order: z.enum(["asc", "desc"]).default("desc"),
  q: z.string().max(100).optional(),
});

export type Pagination = z.infer<typeof paginationSchema>;

export function pageArgs(p: Pagination) {
  return { skip: (p.page - 1) * p.pageSize, take: p.pageSize };
}

export function paged<T>(items: T[], total: number, p: Pagination) {
  return ok(items, { meta: { page: p.page, pageSize: p.pageSize, total, totalPages: Math.max(1, Math.ceil(total / p.pageSize)) } });
}

/** Whitelist sorting so clients cannot order by arbitrary columns. */
export function orderBy<T extends string>(p: Pagination, allowed: readonly T[], fallback: T) {
  const field = (allowed as readonly string[]).includes(p.sortBy ?? "") ? (p.sortBy as T) : fallback;
  return { [field]: p.order } as Record<T, "asc" | "desc">;
}

export async function parseBody<S extends z.ZodTypeAny>(req: Request, schema: S): Promise<z.infer<S>> {
  let json: unknown;
  try {
    json = await req.json();
  } catch {
    throw badRequest("Request body must be valid JSON");
  }
  return schema.parse(json);
}

export function parseQuery<S extends z.ZodTypeAny>(params: URLSearchParams, schema: S): z.infer<S> {
  return schema.parse(Object.fromEntries(params.entries()));
}
