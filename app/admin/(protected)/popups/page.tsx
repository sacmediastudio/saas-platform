import { requireAdmin } from "@/lib/admin-auth";
import { db } from "@/lib/db";
import PopupsView from "./popups-view";

export default async function AdminPopupsPage() {
  await requireAdmin();

  const [popups, tenants] = await Promise.all([
    db.appPopup.findMany({ orderBy: { createdAt: "desc" } }),
    db.tenant.findMany({ where: { nowEnabled: true }, select: { slug: true, name: true }, orderBy: { name: "asc" } }),
  ]);

  return (
    <PopupsView
      tenants={tenants}
      initialPopups={popups.map((p) => ({
        id: p.id,
        title: p.title,
        imageUrl: p.imageUrl,
        tenantSlug: p.tenantSlug,
        linkUrl: p.linkUrl,
        active: p.active,
        startsAt: p.startsAt?.toISOString() ?? null,
        endsAt: p.endsAt?.toISOString() ?? null,
        createdAt: p.createdAt.toISOString(),
      }))}
    />
  );
}
