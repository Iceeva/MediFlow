import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export const cn = (...inputs: ClassValue[]) => twMerge(clsx(inputs));

export const formatDate = (v: string | Date | null | undefined) =>
  v ? new Intl.DateTimeFormat("en-GB", { dateStyle: "medium" }).format(new Date(v)) : "-";

export const formatDateTime = (v: string | Date | null | undefined) =>
  v ? new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short" }).format(new Date(v)) : "-";

export const formatMoney = (v: string | number | null | undefined, currency = "XOF") => {
  const n = Number(v ?? 0);
  try {
    return new Intl.NumberFormat("en-US", { style: "currency", currency, maximumFractionDigits: currency === "XOF" ? 0 : 2 }).format(n);
  } catch {
    return `${n} ${currency}`;
  }
};

export const fullName = (p?: { firstName?: string; lastName?: string } | null) => (p ? `${p.firstName ?? ""} ${p.lastName ?? ""}`.trim() : "-");

export const age = (dob: string | Date) => Math.floor((Date.now() - new Date(dob).getTime()) / 31_557_600_000);

export const initials = (name: string) => name.split(/\s+/).map((p) => p[0]).slice(0, 2).join("").toUpperCase();
