"use client";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "./button";
import { EmptyState, ErrorState } from "../shared/states";
import { cn } from "@/lib/utils";

export interface Column<T> { key: string; header: string; cell: (row: T) => React.ReactNode; className?: string }
export interface Meta { page: number; pageSize: number; total: number; totalPages: number }

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("animate-pulse rounded bg-line/70", className)} aria-hidden />;
}

export function DataTable<T extends { id: string }>({
  columns, rows, loading, error, meta, onPage, onRowClick, empty, onRetry,
}: {
  columns: Column<T>[]; rows?: T[]; loading?: boolean; error?: Error | null; meta?: Meta; onPage?: (p: number) => void;
  onRowClick?: (row: T) => void; empty?: { title: string; description?: string; action?: React.ReactNode }; onRetry?: () => void;
}) {
  if (error) return <ErrorState message={error.message} onRetry={onRetry} />;
  return (
    <div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] text-left">
          <thead>
            <tr className="border-b border-line text-sm text-muted">
              {columns.map((c) => <th key={c.key} scope="col" className={cn("px-4 py-2 font-bold", c.className)}>{c.header}</th>)}
            </tr>
          </thead>
          <tbody>
            {loading && Array.from({ length: 5 }, (_, i) => (
              <tr key={i} className="border-b border-line/60">{columns.map((c) => <td key={c.key} className="px-4 py-3"><Skeleton className="h-4 w-3/4" /></td>)}</tr>
            ))}
            {!loading && rows?.map((r) => (
              <tr key={r.id} className={cn("border-b border-line/60", onRowClick && "cursor-pointer hover:bg-primary-soft/50")}
                onClick={() => onRowClick?.(r)} tabIndex={onRowClick ? 0 : undefined}
                onKeyDown={(e) => { if (onRowClick && e.key === "Enter") onRowClick(r); }}>
                {columns.map((c) => <td key={c.key} className={cn("px-4 py-3 align-top", c.className)}>{c.cell(r)}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!loading && rows?.length === 0 && <EmptyState {...(empty ?? { title: "Nothing here yet" })} />}
      {meta && meta.totalPages > 1 && (
        <nav className="flex items-center justify-between border-t border-line px-4 py-3" aria-label="Pagination">
          <p className="text-sm text-muted">Page {meta.page} of {meta.totalPages} - {meta.total} results</p>
          <div className="flex gap-2">
            <Button variant="secondary" size="sm" disabled={meta.page <= 1} onClick={() => onPage?.(meta.page - 1)}><ChevronLeft className="h-4 w-4" />Previous</Button>
            <Button variant="secondary" size="sm" disabled={meta.page >= meta.totalPages} onClick={() => onPage?.(meta.page + 1)}>Next<ChevronRight className="h-4 w-4" /></Button>
          </div>
        </nav>
      )}
    </div>
  );
}
