import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireTenant } from "@/lib/auth";

const schema = z.object({
  serviceId: z.string(),
  staffId: z.string().optional(),
  customerName: z.string().min(1),
  customerEmail: z.string().email(),
  customerPhone: z.string().optional(),
  datetime: z.string().datetime(),
});

// POST /api/bookings/manual — a diferencia de POST /api/bookings (público,
// usado por el flujo de reserva del cliente final), este endpoint requiere
// sesión de dashboard y crea la cita ya CONFIRMED: el dueño la está
// registrando él mismo (una llamada telefónica, alguien que llegó sin
// reservar, etc.), no necesita pasar por el estado PENDING.
export async function POST(req: NextRequest) {
  const session = await requireTenant();
  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const { serviceId, staffId, datetime, ...customer } = parsed.data;

  // El servicio debe pertenecer al tenant de la sesión — evita que alguien
  // cree una cita contra el servicio de otro negocio adivinando el id.
  const service = await db.service.findFirst({ where: { id: serviceId, tenantId: session.tenantId } });
  if (!service) {
    return NextResponse.json({ error: "Servicio no encontrado" }, { status: 404 });
  }

  const start = new Date(datetime);
  const end = new Date(start.getTime() + service.durationMinutes * 60_000);

  const blockConflict = await db.availabilityBlock.findFirst({
    where: {
      tenantId: session.tenantId,
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
      tenantId: session.tenantId,
      serviceId,
      staffId,
      datetime: start,
      status: "CONFIRMED",
      ...customer,
    },
  });

  return NextResponse.json({ booking }, { status: 201 });
}
