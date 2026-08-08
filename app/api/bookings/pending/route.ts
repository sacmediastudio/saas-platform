import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireTenant } from "@/lib/auth";

// GET /api/bookings/pending — todas las citas en estado PENDING del
// negocio, sin importar en qué día caigan. El calendario del dashboard
// solo muestra un día a la vez, así que esto es lo que le permite al
// dueño ver de un vistazo todo lo que necesita confirmar, sin tener que
// ir navegando día por día.
export async function GET() {
  const session = await requireTenant();

  const bookings = await db.booking.findMany({
    where: { tenantId: session.tenantId, status: "PENDING" },
    include: { service: true, staff: true },
    orderBy: { datetime: "asc" },
  });

  return NextResponse.json({
    bookings: bookings.map((b) => ({
      id: b.id,
      datetime: b.datetime.toISOString(),
      customerName: b.customerName,
      customerEmail: b.customerEmail,
      customerPhone: b.customerPhone,
      serviceName: b.service.name,
      staffName: b.staff?.name ?? null,
    })),
  });
}
