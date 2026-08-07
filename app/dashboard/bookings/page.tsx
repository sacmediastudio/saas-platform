import { redirect } from "next/navigation";
import { requireTenant } from "@/lib/auth";
import { db } from "@/lib/db";
import { getViewsLast7Days } from "@/lib/analytics";
import { getEnabledModules, moduleDashboardPath } from "@/lib/modules";
import BookingsView from "./bookings-view";

export default async function BookingsPage() {
  const session = await requireTenant();

  const tenant = await db.tenant.findUnique({ where: { id: session.tenantId } });
  if (!tenant) redirect("/login");
  // El módulo de citas puede o no estar activo para este negocio — otros
  // no deberían poder llegar aquí ni por URL directa.
  const enabledModules = getEnabledModules(tenant);
  if (!enabledModules.includes("SMALL_BUSINESS")) {
    redirect(moduleDashboardPath(enabledModules[0]));
  }

  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date();
  endOfDay.setHours(23, 59, 59, 999);

  const [bookings, totalBookings, reviews, viewsLast7Days] = await Promise.all([
    db.booking.findMany({
      where: { tenantId: session.tenantId, datetime: { gte: startOfDay, lte: endOfDay } },
      include: { service: true, staff: true },
      orderBy: { datetime: "asc" },
    }),
    db.booking.count({ where: { tenantId: session.tenantId } }),
    db.review.findMany({ where: { tenantId: session.tenantId, status: "PUBLISHED" } }),
    getViewsLast7Days(session.tenantId, "BOOK"),
  ]);

  const serialized = bookings.map((b) => ({
    id: b.id,
    datetime: b.datetime.toISOString(),
    status: b.status,
    customerName: b.customerName,
    serviceName: b.service.name,
    staffName: b.staff?.name ?? null,
  }));

  const avgRating =
    reviews.length > 0 ? reviews.reduce((s, r) => s + r.rating, 0) / reviews.length : null;

  return (
    <BookingsView
      initialBookings={serialized}
      slug={tenant.slug}
      viewsLast7Days={viewsLast7Days}
      totalBookings={totalBookings}
      avgRating={avgRating}
    />
  );
}
