import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireTenant } from "@/lib/auth";
import { isSlotFree } from "@/lib/availability";

const createSchema = z.object({
  serviceId: z.string(),
  staffId: z.string().optional(),
  customerName: z.string().min(1),
  customerEmail: z.string().email(),
  customerPhone: z.string().optional(),
  datetime: z.string().datetime(), // ISO string
  language: z.enum(["es", "en"]).optional(),
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

  // Mismo motor de disponibilidad que usa la vista pública para ofrecer
  // horarios — respeta horario de atención, citas existentes + buffer,
  // y bloqueos. Evita que alguien reserve un horario que dejó de estar
  // disponible entre que cargó la página y que confirmó.
  const free = await isSlotFree({ tenantId: service.tenantId, serviceId, datetime: start });
  if (!free) {
    return NextResponse.json({ error: "Ese horario ya no está disponible" }, { status: 409 });
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

  return NextResponse.json({ booking }, { status: 201 });
}
