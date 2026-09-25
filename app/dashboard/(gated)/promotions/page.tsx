import { requirePagePermission } from "@/lib/auth";
import { db } from "@/lib/db";
import PromotionsView from "./promotions-view";

export default async function PromotionsPage() {
  const session = await requirePagePermission("PROMOTIONS");
  const promotions = await db.promotion.findMany({
    where: { tenantId: session.tenantId },
    orderBy: { createdAt: "desc" },
  });
  return (
    <PromotionsView
      initialPromotions={promotions.map((p) => ({
        ...p,
        startsAt: p.startsAt?.toISOString() ?? null,
        endsAt: p.endsAt?.toISOString() ?? null,
        createdAt: p.createdAt.toISOString(),
      }))}
    />
  );
}
