import { redirect } from "next/navigation";
import { requireTenant } from "@/lib/auth";
import { db } from "@/lib/db";
import { getViewsLast7Days } from "@/lib/analytics";
import SmartLinkEditor from "./smartlink-editor";

export default async function SmartLinkPage() {
  const session = await requireTenant();

  const tenant = await db.tenant.findUnique({ where: { id: session.tenantId } });
  if (!tenant) redirect("/login");
  if (tenant.businessType !== "SMARTLINK") {
    redirect(tenant.businessType === "RESTAURANT" ? "/dashboard/menu" : "/dashboard/bookings");
  }

  const [items, viewsLast7Days] = await Promise.all([
    db.smartLinkItem.findMany({
      where: { tenantId: session.tenantId },
      orderBy: { sortOrder: "asc" },
    }),
    getViewsLast7Days(session.tenantId, "LINK"),
  ]);

  return (
    <SmartLinkEditor
      tenant={{ name: tenant.name, slug: tenant.slug, logoUrl: tenant.logoUrl }}
      initialItems={items}
      viewsLast7Days={viewsLast7Days}
    />
  );
}
