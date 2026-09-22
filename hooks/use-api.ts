"use client";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { api, ApiClientError, qs, type ApiResult } from "@/lib/client";

type Params = Record<string, string | number | boolean | undefined | null>;

export function useList<T>(path: string, params: Params = {}, enabled = true) {
  const q = useQuery({
    queryKey: [path, params],
    queryFn: () => api<T[]>(`${path}${qs(params)}`),
    placeholderData: keepPreviousData,
    enabled,
  });
  return { ...q, rows: q.data?.data, meta: q.data?.meta };
}

export function useOne<T>(path: string, enabled = true) {
  const q = useQuery({ queryKey: [path], queryFn: () => api<T>(path), enabled });
  return { ...q, item: q.data?.data };
}

export function useApiMutation<V, R = unknown>(opts: {
  run: (v: V) => Promise<ApiResult<R>>;
  invalidate?: string[];
  success?: string;
  onDone?: (r: R) => void;
}) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: opts.run,
    onSuccess: (res) => {
      opts.invalidate?.forEach((k) => client.invalidateQueries({ predicate: (q) => String(q.queryKey[0]).startsWith(k) }));
      if (opts.success) toast.success(opts.success);
      opts.onDone?.(res.data);
    },
    onError: (e) => toast.error(e instanceof ApiClientError ? e.message : "Something went wrong"),
  });
}

export const useMe = () =>
  useQuery({ queryKey: ["/auth/me"], queryFn: () => api<{ user: { firstName: string; lastName: string; email: string }; role: string; permissions: string[]; doctorId: string | null; patientId: string | null; tenant: { name: string; slug: string } | null }>("/auth/me"), staleTime: 60_000 });
