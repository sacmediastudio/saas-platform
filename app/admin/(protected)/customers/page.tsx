import { requireAdmin } from "@/lib/admin-auth";
import { db } from "@/lib/db";
import AdminCustomersView from "./admin-customers-view";

export default async function AdminCustomersPage() {
  await requireAdmin();

  const customers = await db.customer.findMany({
    orderBy: { lastSeenAt: "desc" },
    take: 500,
    include: { tenant: { select: { name: true, slug: true } } },
  });

  return (
    <AdminCustomersView
      customers={customers.map((c) => ({
        id: c.id,
        name: c.name,
        email: c.email,
        phone: c.phone,
        tenantName: c.tenant.name,
        tenantSlug: c.tenant.slug,
        fromBooking: c.fromBooking,
        fromReview: c.fromReview,
        fromMenuLead: c.fromMenuLead,
        unsubscribed: c.unsubscribed,
        lastSeenAt: c.lastSeenAt.toISOString(),
      }))}
    />
  );
}
