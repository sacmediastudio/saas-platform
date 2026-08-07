import { redirect } from "next/navigation";
import { requireTenant } from "@/lib/auth";
import { db } from "@/lib/db";
import { getViewsTrend, getTotalViews } from "@/lib/analytics";
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
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  const [bookings, totalBookings, bookingsLast7Days, reviews, viewsTrend, totalViews, bookingsByService] =
    await Promise.all([
      db.booking.findMany({
        where: { tenantId: session.tenantId, datetime: { gte: startOfDay, lte: endOfDay } },
        include: { service: true, staff: true },
        orderBy: { datetime: "asc" },
      }),
      db.booking.count({ where: { tenantId: session.tenantId } }),
      db.booking.count({ where: { tenantId: session.tenantId, createdAt: { gte: sevenDaysAgo } } }),
      db.review.findMany({ where: { tenantId: session.tenantId, status: "PUBLISHED" } }),
      getViewsTrend(session.tenantId, "BOOK"),
      getTotalViews(session.tenantId, "BOOK"),
      db.booking.groupBy({
        by: ["serviceId"],
        where: { tenantId: session.tenantId },
        _count: true,
        orderBy: { _count: { serviceId: "desc" } },
        take: 5,
      }),
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

  const serviceIds = bookingsByService.map((b) => b.serviceId);
  const services = await db.service.findMany({ where: { id: { in: serviceIds } } });
  const topServices = bookingsByService.map((b) => ({
    name: services.find((s) => s.id === b.serviceId)?.name ?? "Servicio eliminado",
    count: b._count,
  }));

  return (
    <BookingsView
      initialBookings={serialized}
      slug={tenant.slug}
      viewsLast7Days={viewsTrend.current}
      viewsChangePercent={viewsTrend.changePercent}
      totalViews={totalViews}
      totalBookings={totalBookings}
      bookingsLast7Days={bookingsLast7Days}
      avgRating={avgRating}
      topServices={topServices}
    />
  );
}
