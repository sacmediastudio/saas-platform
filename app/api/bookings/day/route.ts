import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireTenant } from "@/lib/auth";
import { getBusinessHours } from "@/lib/availability";
import { getDayBoundsInTz, getDayOfWeekInTz } from "@/lib/timezone";

// GET /api/bookings/day?date=YYYY-MM-DD — todo lo necesario para pintar
// la vista de calendario de un día: horario de atención ese día de la
// semana, citas, y bloqueos.
export async function GET(req: NextRequest) {
  const session = await requireTenant();
  const { searchParams } = new URL(req.url);
  const dateParam = searchParams.get("date");
  if (!dateParam || !/^\d{4}-\d{2}-\d{2}$/.test(dateParam)) {
    return NextResponse.json({ error: "Falta o es inválido el parámetro date" }, { status: 400 });
  }

  const tenant = await db.tenant.findUnique({ where: { id: session.tenantId }, select: { timezone: true } });
  const tz = tenant?.timezone ?? "America/Aruba";

  // Antes esto se calculaba con new Date(year, month-1, day) + setHours(),
  // que en el servidor (Railway, en UTC) daba un rango de "el día" corrido
  // varias horas respecto al día real del negocio — por eso algunas citas
  // no aparecían en este calendario aunque sí existían y sincronizaban
  // bien con Google Calendar (que usa el instante UTC real, sin este
  // problema). Ahora se calcula en la zona horaria real del negocio.
  const { start: dayStart, end: dayEnd } = getDayBoundsInTz(dateParam, tz);
  const dayOfWeek = getDayOfWeekInTz(dayStart, tz);

  const [hours, bookings, blocks] = await Promise.all([
    getBusinessHours(session.tenantId),
    db.booking.findMany({
      where: { tenantId: session.tenantId, datetime: { gte: dayStart, lte: dayEnd } },
      include: { service: true, staff: true },
      orderBy: { datetime: "asc" },
    }),
    db.availabilityBlock.findMany({
      where: {
        tenantId: session.tenantId,
        startTime: { lt: dayEnd },
        endTime: { gt: dayStart },
      },
    }),
  ]);

  const dayHours = hours.find((h) => h.dayOfWeek === dayOfWeek) ?? {
    dayOfWeek,
    isOpen: false,
    startTime: "09:00",
    endTime: "18:00",
  };

  return NextResponse.json({
    dayHours,
    bookings: bookings.map((b) => ({
      id: b.id,
      datetime: b.datetime.toISOString(),
      durationMinutes: b.service.durationMinutes,
      status: b.status,
      customerName: b.customerName,
      customerEmail: b.customerEmail,
      customerPhone: b.customerPhone,
      serviceName: b.service.name,
      staffName: b.staff?.name ?? null,
    })),
    blocks: blocks.map((b) => ({
      id: b.id,
      startTime: b.startTime.toISOString(),
      endTime: b.endTime.toISOString(),
      reason: b.reason,
    })),
  });
}
