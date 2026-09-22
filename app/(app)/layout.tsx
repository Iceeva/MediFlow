import { redirect } from "next/navigation";
import { AppShell } from "@/components/layout/app-shell";
import { getAuth } from "@/lib/session";
import { ROLE_PERMISSIONS } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const auth = await getAuth(); // validated against the database, not just the cookie
  if (!auth) redirect("/login");
  const tenant = auth.tenantId ? await prisma.tenant.findUnique({ where: { id: auth.tenantId }, select: { name: true } }) : null;
  return (
    <AppShell user={{ name: auth.name, email: auth.email, role: auth.role, tenantName: tenant?.name ?? null, permissions: [...ROLE_PERMISSIONS[auth.role]] }}>
      {children}
    </AppShell>
  );
}
