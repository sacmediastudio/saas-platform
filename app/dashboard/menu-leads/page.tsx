import { requireTenant } from "@/lib/auth";
import { db } from "@/lib/db";
import MenuLeadsView from "./menu-leads-view";

export default async function MenuLeadsPage() {
  const session = await requireTenant();
  const tenant = await db.tenant.findUnique({
    where: { id: session.tenantId },
    select: { menuLeadEnabled: true, menuLeadButtonLabel: true, menuLeadRewardText: true },
  });
  const leads = await db.menuLead.findMany({
    where: { tenantId: session.tenantId },
    orderBy: { createdAt: "desc" },
  });

  return (
    <MenuLeadsView
      initialEnabled={tenant?.menuLeadEnabled ?? false}
      initialButtonLabel={tenant?.menuLeadButtonLabel ?? "Postre gratis 🎁"}
      initialRewardText={tenant?.menuLeadRewardText ?? "un postre gratis en tu próxima visita"}
      initialLeads={leads}
    />
  );
}
