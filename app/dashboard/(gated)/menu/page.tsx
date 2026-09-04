import { redirect } from "next/navigation";
import { requireTenant } from "@/lib/auth";
import { db } from "@/lib/db";
import { getViewsTrend, getTotalViews } from "@/lib/analytics";
import { getEnabledModules, moduleDashboardPath } from "@/lib/modules";
import MenuEditor from "./menu-editor";

// Repara platos que quedaron con sortOrder=0 duplicado dentro de la
// misma categoría — un bug real de antes, nunca se les asignaba un
// valor propio al crearlos, así que "subir"/"bajar" no tenía nada
// real que intercambiar entre platos que compartían el mismo 0. Se
// ejecuta una sola vez por categoría afectada — una vez reparada, sus
// valores ya quedan distintos entre sí y esto no vuelve a tocarla.
async function ensureItemSortOrder(
  items: { id: string; categoryId: string; sortOrder: number }[]
): Promise<void> {
  const byCategory = new Map<string, typeof items>();
  for (const item of items) {
    const list = byCategory.get(item.categoryId) ?? [];
    list.push(item);
    byCategory.set(item.categoryId, list);
  }

  const updates: Promise<unknown>[] = [];
  for (const catItems of byCategory.values()) {
    const uniqueValues = new Set(catItems.map((i) => i.sortOrder));
    if (uniqueValues.size === catItems.length) continue; // ya están todos distintos, no hace falta tocar nada

    catItems.forEach((item, idx) => {
      if (item.sortOrder !== idx) {
        item.sortOrder = idx; // se refleja también en lo que ya se va a devolver, sin pedir todo de nuevo
        updates.push(db.menuItem.update({ where: { id: item.id }, data: { sortOrder: idx } }));
      }
    });
  }
  if (updates.length > 0) await Promise.all(updates);
}

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

  await ensureItemSortOrder(items);

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
