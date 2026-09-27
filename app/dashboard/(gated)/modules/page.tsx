import { redirect } from "next/navigation";
import { requirePagePermission } from "@/lib/auth";
import { db } from "@/lib/db";
import { getEnabledModules } from "@/lib/modules";
import ModulesManager from "@/components/modules-manager";

export default async function ModulesPage() {
  const session = await requirePagePermission("MODULES");
  const tenant = await db.tenant.findUnique({ where: { id: session.tenantId } });
  if (!tenant) redirect("/login");

  const pendingRequests = await db.moduleActivationRequest.findMany({
    where: { tenantId: session.tenantId, status: "pending" },
  });

  const enabledModules = getEnabledModules(tenant);

  return (
    <ModulesManager
      initialEnabled={enabledModules}
      initialPending={pendingRequests.map((r) => r.module) as any}
      ordersUnlocked={enabledModules.includes("RESTAURANT") && tenant.nowEnabled}
    />
  );
}
