export class ApiClientError extends Error {
  constructor(public status: number, public code: string, message: string, public details?: { fieldErrors?: Record<string, string[]> }) {
    super(message);
  }
}

export interface ApiResult<T> { data: T; meta?: { page: number; pageSize: number; total: number; totalPages: number; unread?: number } }

/** Thin fetch wrapper for the /api/v1 REST API. Cookies are HTTP-only and sent automatically. */
export async function api<T>(path: string, init: { method?: string; json?: unknown; form?: FormData; headers?: Record<string, string> } = {}): Promise<ApiResult<T>> {
  const res = await fetch(`/api/v1${path}`, {
    method: init.method ?? (init.json || init.form ? "POST" : "GET"),
    headers: { ...(init.json ? { "Content-Type": "application/json" } : {}), ...init.headers },
    body: init.form ?? (init.json ? JSON.stringify(init.json) : undefined),
    credentials: "same-origin",
  });
  const body = await res.json().catch(() => null);
  if (!res.ok) {
    if (res.status === 401 && typeof window !== "undefined" && !location.pathname.startsWith("/login")) {
      location.assign(`/login?next=${encodeURIComponent(location.pathname)}`);
    }
    throw new ApiClientError(res.status, body?.error?.code ?? "ERROR", body?.error?.message ?? "Request failed", body?.error?.details);
  }
  return body as ApiResult<T>;
}

export const qs = (params: Record<string, string | number | boolean | undefined | null>) => {
  const u = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== null && v !== "") u.set(k, String(v));
  const s = u.toString();
  return s ? `?${s}` : "";
};

export const idempotencyKey = () => crypto.randomUUID();
