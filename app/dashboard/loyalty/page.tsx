import { requireTenant } from "@/lib/auth";
import { db } from "@/lib/db";
import LoyaltyView from "./loyalty-view";

export default async function LoyaltyPage() {
  const session = await requireTenant();
  const tenant = await db.tenant.findUnique({
    where: { id: session.tenantId },
    select: { loyaltyEnabled: true, loyaltyVisitsNeeded: true, loyaltyReward: true, slug: true },
  });
  const cards = await db.loyaltyCard.findMany({
    where: { tenantId: session.tenantId },
    orderBy: { stamps: "desc" },
  });

  return (
    <LoyaltyView
      initialEnabled={tenant?.loyaltyEnabled ?? false}
      initialVisitsNeeded={tenant?.loyaltyVisitsNeeded ?? 6}
      initialReward={tenant?.loyaltyReward ?? "Tu próxima visita es gratis"}
      slug={tenant?.slug ?? ""}
      initialCards={cards}
    />
  );
}
