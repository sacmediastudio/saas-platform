import { requireTenant } from "@/lib/auth";
import { db } from "@/lib/db";
import CustomersView from "./customers-view";

export default async function CustomersPage() {
  const session = await requireTenant();
  const [customers, loyaltyCards] = await Promise.all([
    db.customer.findMany({
      where: { tenantId: session.tenantId },
      orderBy: { lastSeenAt: "desc" },
    }),
    db.loyaltyCard.findMany({ where: { tenantId: session.tenantId } }),
  ]);

  // Cruce por correo — LoyaltyCard no tiene una relación directa con
  // Customer (son 2 tablas separadas, cada una con su propio
  // historial), así que se buscan por el mismo correo normalizado.
  const stampsByEmail = new Map(loyaltyCards.map((lc) => [lc.customerEmail.toLowerCase(), lc.stamps]));

  return (
    <CustomersView
      customers={customers.map((c) => ({
        id: c.id,
        name: c.name,
        email: c.email,
        phone: c.phone,
        fromBooking: c.fromBooking,
        fromReview: c.fromReview,
        fromMenuLead: c.fromMenuLead,
        fromOrder: c.fromOrder,
        loyaltyStamps: stampsByEmail.get(c.email.toLowerCase()) ?? null,
        lastSeenAt: c.lastSeenAt.toISOString(),
      }))}
    />
  );
}
