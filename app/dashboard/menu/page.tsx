import { redirect } from "next/navigation";
import { requireTenant } from "@/lib/auth";
import { db } from "@/lib/db";
import { getViewsTrend, getTotalViews } from "@/lib/analytics";
import { getEnabledModules, moduleDashboardPath } from "@/lib/modules";
import MenuEditor from "./menu-editor";

export default async function MenuPage() {
  const session = await requireTenant();

  const tenant = await db.tenant.findUnique({ where: { id: session.tenantId } });
  if (!tenant) redirect("/login");
  // El módulo de menú puede o no estar activo para este negocio — otros
  // no deberían poder llegar aquí ni por URL directa.
  const enabledModules = getEnabledModules(tenant);
  if (!enabledModules.includes("RESTAURANT")) {
    redirect(moduleDashboardPath(enabledModules[0]));
  }

  const [categories, items, reviews, viewsTrend, totalViews] = await Promise.all([
    db.menuCategory.findMany({
      where: { tenantId: session.tenantId },
      orderBy: { sortOrder: "asc" },
    }),
    db.menuItem.findMany({
      where: { tenantId: session.tenantId },
      include: { addOns: { orderBy: { sortOrder: "asc" } } },
      orderBy: { sortOrder: "asc" },
    }),
    db.review.findMany({ where: { tenantId: session.tenantId, status: "PUBLISHED" } }),
    getViewsTrend(session.tenantId, "MENU"),
    getTotalViews(session.tenantId, "MENU"),
  ]);

  // Serializar Decimal -> number para pasarlo a un client component.
  const serializedItems = items.map((i) => ({ ...i, price: Number(i.price) }));
  const avgRating =
    reviews.length > 0 ? reviews.reduce((s, r) => s + r.rating, 0) / reviews.length : null;

  return (
    <MenuEditor
      categories={categories}
      initialItems={serializedItems}
      currency={tenant.currency}
      slug={tenant.slug}
      viewsLast7Days={viewsTrend.current}
      viewsChangePercent={viewsTrend.changePercent}
      totalViews={totalViews}
      avgRating={avgRating}
    />
  );
}
