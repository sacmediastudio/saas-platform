import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { isWhatsAppConfigured, sendBookingReminder } from "@/lib/whatsapp";
import { getMinutesOfDayInTz } from "@/lib/timezone";

const CRON_SECRET = process.env.CRON_SECRET;
// Cuánto margen (en minutos) se acepta alrededor del horario exacto del
// recordatorio — necesario porque este endpoint no corre exactamente
// cada minuto, sino cada cierto intervalo (ver .env.example).
const WINDOW_MINUTES = 15;

// POST /api/cron/send-booking-reminders — pensado para que lo llame un
// cron externo cada 15-30 minutos (Railway Cron Schedule, cron-job.org,
// etc.), NO para que lo llame un usuario o el navegador.
export async function POST(req: NextRequest) {
  const secret = req.headers.get("x-cron-secret");
  if (!CRON_SECRET || !secret || secret !== CRON_SECRET) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  if (!isWhatsAppConfigured()) {
    return NextResponse.json({ sent: 0, skipped: "WhatsApp no configurado" });
  }

  const tenants = await db.tenant.findMany({
    where: { remindersEnabled: true },
    select: { id: true, name: true, timezone: true, reminderHoursBefore: true },
  });

  let sent = 0;
  let failed = 0;

  for (const tenant of tenants) {
    const targetMs = Date.now() + tenant.reminderHoursBefore * 60 * 60_000;
    const windowStart = new Date(targetMs - WINDOW_MINUTES * 60_000);
    const windowEnd = new Date(targetMs + WINDOW_MINUTES * 60_000);

    const bookings = await db.booking.findMany({
      where: {
        tenantId: tenant.id,
        status: "CONFIRMED",
        reminderSentAt: null,
        customerPhone: { not: null },
        datetime: { gte: windowStart, lte: windowEnd },
      },
      include: { service: true },
    });

    for (const booking of bookings) {
      if (!booking.customerPhone) continue;
      try {
        const minutes = getMinutesOfDayInTz(booking.datetime, tenant.timezone);
        const timeLabel = `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
        const dateLabel = booking.datetime.toLocaleDateString(booking.language === "en" ? "en-US" : "es", {
          timeZone: tenant.timezone,
          day: "numeric",
          month: "long",
        });

        await sendBookingReminder({
          toPhone: booking.customerPhone,
          customerName: booking.customerName,
          serviceName: booking.service.name,
          businessName: tenant.name,
          dateLabel,
          timeLabel,
          language: booking.language,
        });

        await db.booking.update({ where: { id: booking.id }, data: { reminderSentAt: new Date() } });
        sent++;
      } catch (err) {
        console.error(`No se pudo mandar recordatorio de la cita ${booking.id}:`, err);
        failed++;
      }
    }
  }

  return NextResponse.json({ sent, failed });
}
