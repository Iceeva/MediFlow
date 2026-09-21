import { cn } from "@/lib/utils";

const TONES = {
  neutral: "bg-paper text-ink border-line",
  primary: "bg-primary-soft text-primary border-primary/30",
  ok: "bg-ok-soft text-ok border-ok/30",
  warn: "bg-warn-soft text-warn border-warn/30",
  danger: "bg-danger-soft text-danger border-danger/30",
} as const;

const STATUS_TONE: Record<string, keyof typeof TONES> = {
  CONFIRMED: "primary", CHECKED_IN: "primary", IN_PROGRESS: "warn", COMPLETED: "ok", PENDING: "warn", CANCELLED: "neutral", NO_SHOW: "danger",
  DRAFT: "neutral", PARTIALLY_PAID: "warn", PAID: "ok", OVERDUE: "danger", SUCCEEDED: "ok", FAILED: "danger", REFUNDED: "neutral",
  ACTIVE: "ok", ON_LEAVE: "warn", INACTIVE: "neutral", SUSPENDED: "danger", SUCCESS: "ok", DENIED: "danger", FAILURE: "danger", DISCONTINUED: "neutral",
};

export function Badge({ tone = "neutral", children, className }: { tone?: keyof typeof TONES; children: React.ReactNode; className?: string }) {
  return <span className={cn("inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-bold", TONES[tone], className)}>{children}</span>;
}

export const StatusBadge = ({ status }: { status: string }) => <Badge tone={STATUS_TONE[status] ?? "neutral"}>{status.replace(/_/g, " ").toLowerCase()}</Badge>;
