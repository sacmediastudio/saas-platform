import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireTenant } from "@/lib/auth";
import { getBusinessHours } from "@/lib/availability";

// GET /api/bookings/day?date=YYYY-MM-DD — todo lo necesario para pintar
// la vista de calendario de un día: horario de atención ese día de la
// semana, citas, y bloqueos.
export async function GET(req: NextRequest) {
  const session = await requireTenant();
  const { searchParams } = new URL(req.url);
  const dateParam = searchParams.get("date");
  if (!dateParam) {
    return NextResponse.json({ error: "Falta el parámetro date" }, { status: 400 });
  }

  const [year, month, day] = dateParam.split("-").map(Number);
  if (!year || !month || !day) {
    return NextResponse.json({ error: "Fecha inválida" }, { status: 400 });
  }
  const date = new Date(year, month - 1, day);
  const dayStart = new Date(date);
  dayStart.setHours(0, 0, 0, 0);
  const dayEnd = new Date(date);
  dayEnd.setHours(23, 59, 59, 999);

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

  const dayOfWeek = date.getDay();
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
