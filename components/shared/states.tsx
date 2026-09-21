import Link from "next/link";
import { AlertTriangle, Inbox, Lock, SearchX } from "lucide-react";
import { Button } from "../ui/button";

export function EmptyState({ title, description, action }: { title: string; description?: string; action?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-2 px-6 py-12 text-center">
      <Inbox className="h-8 w-8 text-muted" aria-hidden />
      <p className="font-bold">{title}</p>
      {description && <p className="max-w-sm text-muted">{description}</p>}
      {action}
    </div>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div role="alert" className="flex flex-col items-center gap-2 px-6 py-12 text-center">
      <AlertTriangle className="h-8 w-8 text-danger" aria-hidden />
      <p className="font-bold">We could not load this</p>
      <p className="max-w-sm text-muted">{message}</p>
      {onRetry && <Button variant="secondary" onClick={onRetry}>Try again</Button>}
    </div>
  );
}

export function StatusPage({ kind }: { kind: "unauthorized" | "forbidden" | "not-found" }) {
  const map = {
    unauthorized: { icon: Lock, title: "Sign in to continue", text: "Your session has ended or you are not signed in.", href: "/login", cta: "Go to sign in" },
    forbidden: { icon: Lock, title: "You do not have access", text: "Your role cannot open this page. Ask a clinic administrator if you need it.", href: "/dashboard", cta: "Back to dashboard" },
    "not-found": { icon: SearchX, title: "Page not found", text: "This page does not exist or was moved.", href: "/dashboard", cta: "Back to dashboard" },
  }[kind];
  const Icon = map.icon;
  return (
    <div className="mx-auto flex max-w-md flex-col items-center gap-3 py-24 text-center">
      <Icon className="h-10 w-10 text-muted" aria-hidden />
      <h1>{map.title}</h1>
      <p className="text-muted">{map.text}</p>
      <Link href={map.href} className="font-bold text-primary underline">{map.cta}</Link>
    </div>
  );
}
