import { requireAdmin } from "@/lib/admin-auth";
import { db } from "@/lib/db";
import NowFeaturedView from "./now-featured-view";

export default async function AdminNowPage() {
  await requireAdmin();

  const tenants = await db.tenant.findMany({
    where: { nowEnabled: true },
    orderBy: [{ nowFeatured: "desc" }, { name: "asc" }],
    select: { id: true, name: true, slug: true, logoUrl: true, nowCategory: true, nowFeatured: true },
  });

  return <NowFeaturedView tenants={tenants} />;
}
