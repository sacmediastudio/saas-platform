import { redirect } from "next/navigation";
import { requireTenant } from "@/lib/auth";
import { db } from "@/lib/db";
import { getEnabledModules } from "@/lib/modules";
import ModulesManager from "@/components/modules-manager";

export default async function ModulesPage() {
  const session = await requireTenant();
  const tenant = await db.tenant.findUnique({ where: { id: session.tenantId } });
  if (!tenant) redirect("/login");

  const pendingRequests = await db.moduleActivationRequest.findMany({
    where: { tenantId: session.tenantId, status: "pending" },
  });

  return (
    <ModulesManager
      initialEnabled={getEnabledModules(tenant)}
      initialPending={pendingRequests.map((r) => r.module) as any}
    />
  );
}
