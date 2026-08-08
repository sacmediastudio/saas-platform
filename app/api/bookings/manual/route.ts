import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireTenant } from "@/lib/auth";
import { sendBookingConfirmationEmail } from "@/lib/email";
import { isSlotFree } from "@/lib/availability";
import { syncBookingToGoogleCalendar } from "@/lib/google-calendar";

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

  const tenant = await db.tenant.findUnique({
    where: { id: session.tenantId },
    select: { name: true, contactPhone: true },
  });

  const start = new Date(datetime);

  const free = await isSlotFree({ tenantId: session.tenantId, serviceId, datetime: start });
  if (!free) {
    return NextResponse.json(
      { error: "Ese horario ya está ocupado o bloqueado." },
      { status: 409 }
    );
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

  if (tenant) {
    await sendBookingConfirmationEmail({
      to: customer.customerEmail,
      customerName: customer.customerName,
      businessName: tenant.name,
      serviceName: service.name,
      datetime: start,
      contactPhone: tenant.contactPhone,
    }).catch((err) => console.error("No se pudo enviar el correo de confirmación:", err));
  }

  await syncBookingToGoogleCalendar({
    tenantId: session.tenantId,
    bookingId: booking.id,
    serviceName: service.name,
    customerName: customer.customerName,
    customerEmail: customer.customerEmail,
    datetime: start,
    durationMinutes: service.durationMinutes,
  });

  return NextResponse.json({ booking }, { status: 201 });
}
