import { redirect } from "next/navigation";
import { requirePagePermission } from "@/lib/auth";
import { db } from "@/lib/db";
import { getViewsTrend, getTotalViews } from "@/lib/analytics";
import SmartLinkEditor from "./smartlink-editor";

// Smartlink es gratis e incluido para cualquier tenant — a diferencia
// de Menú/Citas, no hay ningún chequeo de enabledModules acá.
export default async function SmartLinkPage() {
  const session = await requirePagePermission("SMARTLINK");

  const tenant = await db.tenant.findUnique({ where: { id: session.tenantId } });
  if (!tenant) redirect("/login");

  const [items, viewsTrend, totalViews, clicksByType] = await Promise.all([
    db.smartLinkItem.findMany({
      where: { tenantId: session.tenantId },
      orderBy: { sortOrder: "asc" },
    }),
    getViewsTrend(session.tenantId, "LINK"),
    getTotalViews(session.tenantId, "LINK"),
    db.smartLinkItem.groupBy({
      by: ["type"],
      where: { tenantId: session.tenantId },
      _sum: { clickCount: true },
    }),
  ]);

  return (
    <SmartLinkEditor
      tenant={{ name: tenant.name, slug: tenant.slug, logoUrl: tenant.logoUrl }}
      initialItems={items}
      viewsLast7Days={viewsTrend.current}
      viewsChangePercent={viewsTrend.changePercent}
      totalViews={totalViews}
      clicksByType={Object.fromEntries(clicksByType.map((c) => [c.type, c._sum.clickCount ?? 0]))}
    />
  );
}
