import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireTenant } from "@/lib/auth";

const createSchema = z.object({
  serviceId: z.string(),
  staffId: z.string().optional(),
  customerName: z.string().min(1),
  customerEmail: z.string().email(),
  customerPhone: z.string().optional(),
  datetime: z.string().datetime(), // ISO string
});

// GET /api/bookings?from=&to= — agenda del negocio en un rango de fechas.
export async function GET(req: NextRequest) {
  const session = await requireTenant();
  const { searchParams } = new URL(req.url);
  const from = searchParams.get("from");
  const to = searchParams.get("to");

  const bookings = await db.booking.findMany({
    where: {
      tenantId: session.tenantId,
      ...(from && to ? { datetime: { gte: new Date(from), lte: new Date(to) } } : {}),
    },
    include: { service: true, staff: true },
    orderBy: { datetime: "asc" },
  });

  return NextResponse.json({ bookings });
}

// POST /api/bookings — crea una reserva pública (usada por la página de
// booking del cliente final, no requiere sesión de dashboard, pero sí
// requiere saber a qué tenant pertenece vía slug -> se resuelve antes
// de llamar este endpoint, ver app/book/[slug]/actions.ts).
export async function POST(req: NextRequest) {
  const body = await req.json();
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { serviceId, staffId, datetime, ...customer } = parsed.data;

  const service = await db.service.findUnique({ where: { id: serviceId } });
  if (!service) {
    return NextResponse.json({ error: "Servicio no encontrado" }, { status: 404 });
  }

  const start = new Date(datetime);
  const end = new Date(start.getTime() + service.durationMinutes * 60_000);

  // Chequeo simple de solapamiento: cualquier reserva confirmada del mismo
  // staff que empiece antes de que termine la nueva Y termine después de
  // que empiece la nueva, es un choque de horario.
  const conflict = await db.booking.findFirst({
    where: {
      tenantId: service.tenantId,
      staffId: staffId ?? undefined,
      status: { in: ["PENDING", "CONFIRMED"] },
      datetime: { lt: end },
      AND: [{ datetime: { gte: new Date(start.getTime() - 4 * 60 * 60_000) } }],
    },
  });
  if (conflict) {
    const conflictService = await db.service.findUnique({ where: { id: conflict.serviceId } });
    const realConflictEnd = new Date(
      conflict.datetime.getTime() + (conflictService?.durationMinutes ?? 0) * 60_000
    );
    if (realConflictEnd > start) {
      return NextResponse.json({ error: "Ese horario ya no está disponible" }, { status: 409 });
    }
  }

  // Un bloqueo (vacaciones, cierre, almuerzo) que se solape con la ventana
  // [start, end) también invalida el horario, tenga o no staff asignado.
  const blockConflict = await db.availabilityBlock.findFirst({
    where: {
      tenantId: service.tenantId,
      OR: [{ staffId: staffId ?? undefined }, { staffId: null }],
      startTime: { lt: end },
      endTime: { gt: start },
    },
  });
  if (blockConflict) {
    return NextResponse.json({ error: "Ese horario está bloqueado" }, { status: 409 });
  }

  const booking = await db.booking.create({
    data: {
      tenantId: service.tenantId,
      serviceId,
      staffId,
      datetime: start,
      status: "PENDING",
      ...customer,
    },
  });

  // TODO: disparar email/SMS de confirmación (ver lib/notifications.ts)

  return NextResponse.json({ booking }, { status: 201 });
}
