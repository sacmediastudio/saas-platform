import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireTenant } from "@/lib/auth";
import { sendBookingConfirmationEmail } from "@/lib/email";
import { syncBookingToGoogleCalendar, deleteGoogleCalendarEvent } from "@/lib/google-calendar";

const schema = z.object({
  status: z.enum(["PENDING", "CONFIRMED", "CANCELLED", "COMPLETED"]),
});

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await requireTenant();

  const existing = await db.booking.findFirst({
    where: { id: params.id, tenantId: session.tenantId },
    include: { service: true, tenant: { select: { name: true, contactPhone: true, timezone: true } } },
  });
  if (!existing) {
    return NextResponse.json({ error: "Reserva no encontrada" }, { status: 404 });
  }

  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const booking = await db.booking.update({
    where: { id: params.id },
    data: { status: parsed.data.status },
  });

  // Solo mandamos correo cuando la cita pasa A confirmada (no si ya lo
  // estaba, para no reenviar el mismo correo si se toca otro campo).
  if (parsed.data.status === "CONFIRMED" && existing.status !== "CONFIRMED") {
    await sendBookingConfirmationEmail({
      to: existing.customerEmail,
      customerName: existing.customerName,
      businessName: existing.tenant.name,
      serviceName: existing.service.name,
      datetime: existing.datetime,
      contactPhone: existing.tenant.contactPhone,
      timezone: existing.tenant.timezone,
    }).catch((err) => console.error("No se pudo enviar el correo de confirmación:", err));

    await syncBookingToGoogleCalendar({
      tenantId: session.tenantId,
      bookingId: existing.id,
      serviceName: existing.service.name,
      customerName: existing.customerName,
      customerEmail: existing.customerEmail,
      datetime: existing.datetime,
      durationMinutes: existing.service.durationMinutes,
    });
  }

  // Si se cancela una cita que ya estaba sincronizada, borramos el
  // evento de Google también — para que el calendario no mienta.
  if (parsed.data.status === "CANCELLED" && existing.googleEventId) {
    await deleteGoogleCalendarEvent(session.tenantId, existing.googleEventId);
  }

  return NextResponse.json({ booking });
}
