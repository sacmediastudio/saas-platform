import { db } from "@/lib/db";
import DashboardCard from "@/components/dashboard-card";

const TYPE_LABELS: Record<string, string> = {
  RESTAURANT: "Restaurantes",
  SMALL_BUSINESS: "Negocios de citas",
  SMARTLINK: "Smartlink",
};

export default async function AdminOverviewPage() {
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  const [totalTenants, byType, newLast7Days, newLast30Days, suspendedCount, subsByStatus, recentTenants] =
    await Promise.all([
      db.tenant.count(),
      db.tenant.groupBy({ by: ["businessType"], _count: true }),
      db.tenant.count({ where: { createdAt: { gte: sevenDaysAgo } } }),
      db.tenant.count({ where: { createdAt: { gte: thirtyDaysAgo } } }),
      db.tenant.count({ where: { suspended: true } }),
      db.subscription.groupBy({ by: ["status"], _count: true }),
      db.tenant.findMany({ orderBy: { createdAt: "desc" }, take: 5 }),
    ]);

  const typeCount = Object.fromEntries(byType.map((b) => [b.businessType, b._count]));
  const statusCount = Object.fromEntries(subsByStatus.map((s) => [s.status, s._count]));

  return (
    <div className="flex flex-col gap-5">
      <DashboardCard>
      <h1 className="text-xl font-semibold mb-1">Resumen</h1>
      <p className="text-sm text-[#343233]/70 mb-7">Todos tus negocios clientes, de un vistazo</p>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 divide-x divide-black/[0.06]">
        <Stat label="Negocios totales" value={totalTenants} />
        <Stat label="Nuevos (7 días)" value={newLast7Days} />
        <Stat label="Nuevos (30 días)" value={newLast30Days} />
        <Stat label="Suspendidos" value={suspendedCount} />
      </div>
      </DashboardCard>

      <DashboardCard>
      <div className="grid md:grid-cols-2 gap-6">
        <div>
          <h2 className="text-sm font-semibold mb-3">Por tipo de negocio</h2>
          <div className="border border-[#002D09]/10 rounded-lg overflow-hidden divide-y divide-[#002D09]/10">
            {Object.entries(TYPE_LABELS).map(([key, label]) => (
              <div key={key} className="flex items-center justify-between px-4 py-3">
                <span className="text-sm">{label}</span>
                <span className="text-sm font-semibold">{typeCount[key] ?? 0}</span>
              </div>
            ))}
          </div>
        </div>

        <div>
          <h2 className="text-sm font-semibold mb-3">Por estado de suscripción</h2>
          <div className="border border-[#002D09]/10 rounded-lg overflow-hidden divide-y divide-[#002D09]/10">
            {["trialing", "active", "past_due", "canceled"].map((status) => (
              <div key={status} className="flex items-center justify-between px-4 py-3">
                <span className="text-sm capitalize">{statusLabel(status)}</span>
                <span className="text-sm font-semibold">{statusCount[status] ?? 0}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
      </DashboardCard>

      <DashboardCard>
      <h2 className="text-sm font-semibold mb-3">Últimos negocios registrados</h2>
      <div className="border border-[#002D09]/10 rounded-lg overflow-hidden divide-y divide-[#002D09]/10">
        {recentTenants.map((t) => (
          <a
            key={t.id}
            href={`/admin/tenants/${t.id}`}
            className="flex items-center justify-between px-4 py-3 hover:bg-[#F7F8F4]"
          >
            <div>
              <p className="text-sm font-medium">{t.name}</p>
              <p className="text-xs text-[#343233]/60">{TYPE_LABELS[t.businessType]}</p>
            </div>
            <span className="text-xs text-[#343233]/60">
              {t.createdAt.toLocaleDateString("es", { day: "numeric", month: "short" })}
            </span>
          </a>
        ))}
        {recentTenants.length === 0 && (
          <p className="px-4 py-6 text-sm text-[#343233]/60">Todavía no hay negocios registrados.</p>
        )}
      </div>
      </DashboardCard>
    </div>
  );
}

function statusLabel(status: string) {
  const labels: Record<string, string> = {
    trialing: "En prueba",
    active: "Activa",
    past_due: "Pago atrasado",
    canceled: "Cancelada",
  };
  return labels[status] ?? status;
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex flex-col items-center text-center gap-1.5 px-2 py-1">
      <span className="text-[2.1rem] leading-none font-extrabold tracking-tight text-[#002D09]">{value}</span>
      <span className="text-[13px] text-[#343233]/60">{label}</span>
    </div>
  );
}
