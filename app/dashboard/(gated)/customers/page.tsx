import { requireTenant } from "@/lib/auth";
import { db } from "@/lib/db";
import CustomersView from "./customers-view";

export default async function CustomersPage() {
  const session = await requireTenant();
  const customers = await db.customer.findMany({
    where: { tenantId: session.tenantId },
    orderBy: { lastSeenAt: "desc" },
  });

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
        lastSeenAt: c.lastSeenAt.toISOString(),
      }))}
    />
  );
}
