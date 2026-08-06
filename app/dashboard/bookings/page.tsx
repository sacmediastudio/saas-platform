import { redirect } from "next/navigation";
import { requireTenant } from "@/lib/auth";
import { db } from "@/lib/db";
import BookingsView from "./bookings-view";

export default async function BookingsPage() {
  const session = await requireTenant();

  const tenant = await db.tenant.findUnique({ where: { id: session.tenantId } });
  if (!tenant) redirect("/login");
  // El módulo de citas es solo para negocios de servicios — otros tipos
  // de negocio no deberían poder llegar aquí ni por URL directa.
  if (tenant.businessType !== "SMALL_BUSINESS") {
    redirect(tenant.businessType === "RESTAURANT" ? "/dashboard/menu" : "/dashboard/smartlink");
  }

  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date();
  endOfDay.setHours(23, 59, 59, 999);

  const bookings = await db.booking.findMany({
    where: { tenantId: session.tenantId, datetime: { gte: startOfDay, lte: endOfDay } },
    include: { service: true, staff: true },
    orderBy: { datetime: "asc" },
  });

  const serialized = bookings.map((b) => ({
    id: b.id,
    datetime: b.datetime.toISOString(),
    status: b.status,
    customerName: b.customerName,
    serviceName: b.service.name,
    staffName: b.staff?.name ?? null,
  }));

  return <BookingsView initialBookings={serialized} />;
}
