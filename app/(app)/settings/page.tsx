"use client";
import { PageHeader } from "@/components/shared/page-header";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/data-table";
import { SecurityPanel } from "@/components/settings/security-panel";
import { ClinicPanel, ClinicsPanel, TeamPanel } from "@/components/settings/admin-panels";
import { usePermissions } from "@/hooks/use-permissions";

export default function SettingsPage() {
  const { me, can, role, isLoading } = usePermissions();
  if (isLoading || !me) return <Skeleton className="h-48 w-full" />;
  return (
    <div className="space-y-6">
      <PageHeader title="Settings" description="Your account, your security and your clinic." />
      <Card>
        <CardHeader title="Your account" />
        <CardBody>
          <dl className="grid gap-4 sm:grid-cols-3">
            <div><dt className="text-sm text-muted">Name</dt><dd className="font-bold">{me.user.firstName} {me.user.lastName}</dd></div>
            <div><dt className="text-sm text-muted">Email</dt><dd className="font-bold">{me.user.email}</dd></div>
            <div><dt className="text-sm text-muted">Role</dt><dd className="font-bold">{role?.replace(/_/g, " ").toLowerCase()}{me.tenant ? ` at ${me.tenant.name}` : ""}</dd></div>
          </dl>
        </CardBody>
      </Card>
      <SecurityPanel />
      {role === "CLINIC_ADMIN" && me.tenant && <ClinicPanel tenant={me.tenant as { id: string; name: string }} />}
      {can("user:manage") && role === "CLINIC_ADMIN" && <TeamPanel />}
      {role === "SUPER_ADMIN" && <ClinicsPanel />}
    </div>
  );
}
