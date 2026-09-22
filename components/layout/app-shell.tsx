"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Bell, LogOut, Menu, X } from "lucide-react";
import { api } from "@/lib/client";
import { cn, initials } from "@/lib/utils";
import { Button } from "../ui/button";
import { GlobalSearch } from "./global-search";
import { NAV } from "./nav";

export interface ShellUser { name: string; email: string; role: string; tenantName: string | null; permissions: string[] }

export function AppShell({ user, children }: { user: ShellUser; children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const items = NAV.filter((n) => !n.permission || user.permissions.includes(n.permission));
  const canSearch = user.permissions.includes("search:use");
  const unread = useQuery({ queryKey: ["/notifications", "unread"], queryFn: () => api<unknown[]>("/notifications?unread=true&pageSize=1"), refetchInterval: 60_000 });
  const count = unread.data?.meta?.unread ?? 0;

  async function logout() {
    await api("/auth/logout", { method: "POST" }).catch(() => undefined);
    router.replace("/login");
    router.refresh();
  }

  const nav = (
    <nav aria-label="Main" className="flex-1 space-y-0.5 overflow-y-auto px-3 py-4">
      {items.map(({ href, label, icon: Icon }) => {
        const active = pathname === href || pathname.startsWith(`${href}/`);
        return (
          <Link key={href} href={href} onClick={() => setOpen(false)} aria-current={active ? "page" : undefined}
            className={cn("flex items-center gap-3 rounded-control px-3 py-2 font-bold text-white/80 hover:bg-white/10 hover:text-white", active && "bg-white/15 text-white")}>
            <Icon className="h-4 w-4" aria-hidden />{label}
          </Link>
        );
      })}
    </nav>
  );

  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[240px_1fr]">
      <aside className="hidden flex-col bg-ink lg:flex">
        <div className="px-6 pb-2 pt-6"><p className="text-xl font-bold text-white">MediFlow</p><p className="truncate text-sm text-white/60">{user.tenantName ?? "Platform administration"}</p></div>
        {nav}
      </aside>
      {open && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-ink/50" onClick={() => setOpen(false)} />
          <aside className="absolute inset-y-0 left-0 flex w-64 flex-col bg-ink">
            <div className="flex items-center justify-between px-6 pt-6"><p className="text-xl font-bold text-white">MediFlow</p><Button variant="ghost" size="icon" className="text-white hover:bg-white/10" onClick={() => setOpen(false)} aria-label="Close menu"><X className="h-4 w-4" /></Button></div>
            {nav}
          </aside>
        </div>
      )}
      <div className="flex min-w-0 flex-col">
        <header className="sticky top-0 z-20 flex items-center gap-3 border-b border-line bg-surface px-4 py-3 lg:px-8">
          <Button variant="ghost" size="icon" className="lg:hidden" onClick={() => setOpen(true)} aria-label="Open menu"><Menu className="h-5 w-5" /></Button>
          {canSearch ? <GlobalSearch /> : <div className="flex-1" />}
          <div className="ml-auto flex items-center gap-2">
            <Link href="/notifications" className="relative rounded-control p-2 hover:bg-primary-soft" aria-label={`Notifications${count ? `, ${count} unread` : ""}`}>
              <Bell className="h-5 w-5" aria-hidden />
              {count > 0 && <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-danger px-1 text-[10px] font-bold text-white">{count > 9 ? "9+" : count}</span>}
            </Link>
            <div className="hidden items-center gap-2 sm:flex">
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary-soft text-sm font-bold text-primary" aria-hidden>{initials(user.name)}</span>
              <div className="leading-tight"><p className="text-sm font-bold">{user.name}</p><p className="text-xs text-muted">{user.role.replace(/_/g, " ").toLowerCase()}</p></div>
            </div>
            <Button variant="ghost" size="icon" onClick={logout} aria-label="Sign out"><LogOut className="h-4 w-4" /></Button>
          </div>
        </header>
        <main id="main" className="flex-1 px-4 py-6 lg:px-8">{children}</main>
      </div>
    </div>
  );
}
