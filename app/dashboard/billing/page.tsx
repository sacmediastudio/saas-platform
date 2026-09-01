import { redirect } from "next/navigation";
import { requireTenant } from "@/lib/auth";
import { db } from "@/lib/db";
import { getEnabledModules } from "@/lib/modules";
import BillingView from "./billing-view";

export default async function BillingPage() {
  const session = await requireTenant();

  const [tenant, subscription] = await Promise.all([
    db.tenant.findUnique({ where: { id: session.tenantId } }),
    db.subscription.findUnique({ where: { tenantId: session.tenantId }, include: { items: true } }),
  ]);
  if (!tenant) redirect("/login");

  return (
    <BillingView
      enabledModules={getEnabledModules(tenant)}
      subscription={
        subscription
          ? {
              status: subscription.status,
              currentPeriodEnd: subscription.currentPeriodEnd?.toISOString() ?? null,
              // Si alguna vez tuvo una suscripción pero ya la canceló,
              // el ID queda guardado igual (no lo borramos) — por eso
              // hay que mirar el ESTADO actual, no solo si existe el
              // campo, o el botón se queda trabado en "Gestionar
              // facturación" para siempre después de la primera vez,
              // sin volver a ofrecer "Suscribirse".
              hasStripeSubscription: subscription.status === "active" || subscription.status === "past_due",
              billedModules: subscription.items.map((i) => i.module),
            }
          : null
      }
    />
  );
}
