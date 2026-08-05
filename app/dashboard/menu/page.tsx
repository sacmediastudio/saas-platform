import { redirect } from "next/navigation";
import { requireTenant } from "@/lib/auth";
import { db } from "@/lib/db";
import MenuEditor from "./menu-editor";

export default async function MenuPage() {
  const session = await requireTenant();

  const tenant = await db.tenant.findUnique({ where: { id: session.tenantId } });
  if (!tenant) redirect("/login");
  // El módulo de menú es solo para restaurantes — un negocio de servicios
  // no debería poder llegar aquí ni por URL directa.
  if (tenant.businessType !== "RESTAURANT") redirect("/dashboard/bookings");

  const [categories, items] = await Promise.all([
    db.menuCategory.findMany({
      where: { tenantId: session.tenantId },
      orderBy: { sortOrder: "asc" },
    }),
    db.menuItem.findMany({
      where: { tenantId: session.tenantId },
      orderBy: { sortOrder: "asc" },
    }),
  ]);

  // Serializar Decimal -> number para pasarlo a un client component.
  const serializedItems = items.map((i) => ({ ...i, price: Number(i.price) }));

  return <MenuEditor categories={categories} initialItems={serializedItems} currency={tenant.currency} />;
}
