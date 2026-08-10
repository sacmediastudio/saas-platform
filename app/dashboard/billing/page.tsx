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
              hasStripeSubscription: Boolean(subscription.stripeSubscriptionId),
              billedModules: subscription.items.map((i) => i.module),
            }
          : null
      }
    />
  );
}
