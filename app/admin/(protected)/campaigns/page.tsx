import { requireAdmin } from "@/lib/admin-auth";
import { db } from "@/lib/db";
import CampaignsView from "./campaigns-view";

export default async function AdminCampaignsPage() {
  await requireAdmin();

  const [tenants, recentCampaigns] = await Promise.all([
    db.tenant.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } }),
    db.campaignLog.findMany({ orderBy: { createdAt: "desc" }, take: 20 }),
  ]);

  return (
    <CampaignsView
      tenants={tenants}
      recentCampaigns={recentCampaigns.map((c) => ({
        id: c.id,
        channel: c.channel,
        subject: c.subject,
        tenantFilter: c.tenantFilter,
        recipientCount: c.recipientCount,
        sentCount: c.sentCount,
        failedCount: c.failedCount,
        createdAt: c.createdAt.toISOString(),
      }))}
    />
  );
}
