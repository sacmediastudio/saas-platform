import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import TenantActions from "@/components/tenant-actions";
import SubscriptionEditor from "@/components/subscription-editor";

const TYPE_LABELS: Record<string, string> = {
  RESTAURANT: "Restaurante",
  SMALL_BUSINESS: "Negocio de citas",
  SMARTLINK: "Smartlink",
};

const PUBLIC_PATH: Record<string, string> = {
  RESTAURANT: "menu",
  SMALL_BUSINESS: "book",
  SMARTLINK: "link",
};

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

  const publicUrl = `/${PUBLIC_PATH[tenant.businessType]}/${tenant.slug}`;

  return (
    <div className="max-w-2xl">
      <a href="/admin/tenants" className="text-sm text-[#343233]/60 hover:text-[#002D09] mb-4 inline-block">
        ← Todos los negocios
      </a>

      <div className="flex items-start justify-between gap-4 mb-1 flex-wrap">
        <h1 className="text-xl font-semibold flex items-center gap-2">
          {tenant.name}
          {tenant.suspended && (
            <span className="text-xs px-2 py-0.5 rounded bg-red-50 text-red-700 font-semibold">SUSPENDIDO</span>
          )}
        </h1>
      </div>
      <p className="text-sm text-[#343233]/70 mb-6">
        {TYPE_LABELS[tenant.businessType]} ·{" "}
        <a href={publicUrl} target="_blank" rel="noopener noreferrer" className="underline hover:text-[#002D09]">
          {publicUrl}
        </a>
      </p>

      <div className="mb-8">
        <TenantActions tenantId={tenant.id} tenantName={tenant.name} suspended={tenant.suspended} />
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8">
        {tenant.businessType === "RESTAURANT" && <Stat label="Platos" value={menuItemCount} />}
        {tenant.businessType === "SMALL_BUSINESS" && <Stat label="Citas" value={bookingCount} />}
        {tenant.businessType === "SMARTLINK" && <Stat label="Links" value={smartLinkItemCount} />}
        <Stat label="Reseñas" value={reviewCount} />
        <Stat label="Plan" value={tenant.plan} />
        <Stat label="Moneda" value={tenant.currency} />
      </div>

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

      <Section title="Datos generales">
        <Row label="Slug" value={tenant.slug} />
        <Row label="Creado" value={tenant.createdAt.toLocaleString("es")} />
        <Row label="Última actualización" value={tenant.updatedAt.toLocaleString("es")} />
        <Row label="ID" value={tenant.id} />
      </Section>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-6">
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
    <div className="bg-[#F7F8F4] rounded-lg p-4">
      <p className="text-sm text-[#343233]/70">{label}</p>
      <p className="text-xl font-semibold mt-1 truncate">{value}</p>
    </div>
  );
}
