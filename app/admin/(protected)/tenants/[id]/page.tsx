import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { getEnabledModules, modulePublicPrefix, MODULE_LABELS } from "@/lib/modules";
import TenantActions from "@/components/tenant-actions";
import SubscriptionEditor from "@/components/subscription-editor";
import DashboardCard from "@/components/dashboard-card";

export default async function AdminTenantDetailPage({ params }: { params: { id: string } }) {
  const tenant = await db.tenant.findUnique({
    where: { id: params.id },
    include: { users: true, subscription: true },
  });
  if (!tenant) notFound();

  const [menuItemCount, bookingCount, smartLinkItemCount, reviewCount] = await Promise.all([
    db.menuItem.count({ where: { tenantId: tenant.id } }),
    db.booking.count({ where: { tenantId: tenant.id } }),
    db.smartLinkItem.count({ where: { tenantId: tenant.id } }),
    db.review.count({ where: { tenantId: tenant.id } }),
  ]);

  const enabledModules = getEnabledModules(tenant);
  const countByModule = { RESTAURANT: menuItemCount, SMALL_BUSINESS: bookingCount, SMARTLINK: smartLinkItemCount };
  const countLabel = { RESTAURANT: "Platos", SMALL_BUSINESS: "Citas", SMARTLINK: "Links" };

  return (
    <div className="max-w-2xl flex flex-col gap-5">
      <a href="/admin/tenants" className="text-sm text-[#343233]/60 hover:text-[#002D09] inline-block">
        ← Todos los negocios
      </a>

      <DashboardCard>
      <div className="flex items-start justify-between gap-4 mb-1 flex-wrap">
        <h1 className="text-xl font-semibold flex items-center gap-2">
          {tenant.name}
          {tenant.suspended && (
            <span className="text-xs px-2 py-0.5 rounded bg-red-50 text-red-700 font-semibold">SUSPENDIDO</span>
          )}
        </h1>
      </div>
      <div className="flex flex-wrap items-center gap-2 mb-6">
        {enabledModules.map((m) => (
          <a
            key={m}
            href={`/${modulePublicPrefix(m)}/${tenant.slug}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs px-2.5 py-1 rounded-md bg-[#F7F8F4] hover:bg-[#eee] underline"
          >
            {MODULE_LABELS[m]}
          </a>
        ))}
      </div>

      <div className="mb-7">
        <TenantActions tenantId={tenant.id} tenantName={tenant.name} suspended={tenant.suspended} />
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 divide-x divide-black/[0.06]">
        {enabledModules.map((m) => (
          <Stat key={m} label={countLabel[m]} value={countByModule[m]} />
        ))}
        <Stat label="Reseñas" value={reviewCount} />
        <Stat label="Plan" value={tenant.plan} />
      </div>
      </DashboardCard>

      <DashboardCard>
      <Section title="Suscripción">
        <div className="px-4 py-3">
          <SubscriptionEditor
            tenantId={tenant.id}
            initialPlan={tenant.subscription?.plan ?? tenant.plan}
            initialStatus={tenant.subscription?.status ?? "trialing"}
          />
        </div>
        <Row
          label="Fin del período actual"
          value={
            tenant.subscription?.currentPeriodEnd
              ? tenant.subscription.currentPeriodEnd.toLocaleDateString("es")
              : "—"
          }
        />
      </Section>

      <Section title="Usuarios">
        {tenant.users.map((u) => (
          <Row key={u.id} label={u.name} value={`${u.email} · ${u.role}`} />
        ))}
      </Section>

      <Section title="Contacto configurado">
        <Row label="Correo" value={tenant.contactEmail ?? "—"} />
        <Row label="Teléfono" value={tenant.contactPhone ?? "—"} />
        <Row label="Dirección" value={tenant.address ?? "—"} />
      </Section>

      <Section title="Datos generales" last>
        <Row label="Slug" value={tenant.slug} />
        <Row label="Moneda" value={tenant.currency} />
        <Row label="Módulo inicial" value={MODULE_LABELS[tenant.businessType]} />
        <Row label="Creado" value={tenant.createdAt.toLocaleString("es")} />
        <Row label="Última actualización" value={tenant.updatedAt.toLocaleString("es")} />
        <Row label="ID" value={tenant.id} />
      </Section>
      </DashboardCard>
    </div>
  );
}

function Section({ title, children, last = false }: { title: string; children: React.ReactNode; last?: boolean }) {
  return (
    <div className={last ? "" : "mb-6"}>
      <h2 className="text-sm font-semibold mb-2">{title}</h2>
      <div className="border border-[#002D09]/10 rounded-lg overflow-hidden divide-y divide-[#002D09]/10">
        {children}
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between px-4 py-2.5 gap-4">
      <span className="text-xs text-[#343233]/60 shrink-0">{label}</span>
      <span className="text-sm text-right truncate">{value}</span>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="flex flex-col items-center text-center gap-1.5 px-2 py-1">
      <span className="text-xl font-extrabold tracking-tight text-[#002D09] truncate max-w-full">{value}</span>
      <span className="text-[13px] text-[#343233]/60">{label}</span>
    </div>
  );
}
