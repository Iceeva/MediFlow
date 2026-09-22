"use client";
import { useMe } from "./use-api";
import type { Permission } from "@/lib/permissions";

/** UI convenience only. The server re-checks every permission, hiding a button is never the protection. */
export function usePermissions() {
  const { data, isLoading } = useMe();
  const me = data?.data;
  return {
    isLoading,
    me,
    role: me?.role,
    can: (p: Permission) => !!me?.permissions.includes(p),
  };
}
