import { requireAdmin } from "@/lib/admin-auth";
import { db } from "@/lib/db";
import ModuleRequestsView from "./module-requests-view";

export default async function AdminModuleRequestsPage() {
  await requireAdmin();

  const requests = await db.moduleActivationRequest.findMany({
    orderBy: { requestedAt: "desc" },
    take: 200,
    include: { tenant: { select: { name: true, slug: true } } },
  });

  return (
    <ModuleRequestsView
      requests={requests.map((r) => ({
        id: r.id,
        tenantName: r.tenant.name,
        tenantSlug: r.tenant.slug,
        module: r.module,
        status: r.status,
        requestedAt: r.requestedAt.toISOString(),
      }))}
    />
  );
}
