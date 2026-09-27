import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/auth";
import { sendOrderConfirmedWithEtaWhatsApp, sendOrderReadyWhatsApp } from "@/lib/whatsapp";

const schema = z.object({
  status: z.enum(["NEW", "ACCEPTED", "PREPARING", "READY", "REJECTED", "COMPLETED", "CANCELLED"]),
  // Solo se usa (y se exige en el frontend) al confirmar — es lo que le
  // permite al negocio avisarle al cliente "listo en X minutos".
  etaMinutes: z.number().int().min(1).max(180).optional(),
});

const READY_FULFILLMENT_NOTE: Record<string, Record<"PICKUP" | "DELIVERY", string>> = {
  es: { PICKUP: "Podés pasar a retirarlo cuando quieras.", DELIVERY: "Ya va en camino." },
  en: { PICKUP: "You can come pick it up anytime.", DELIVERY: "It's on its way." },
};

// Timestamp que corresponde marcar según a qué estado se mueve el pedido —
// alimenta el cronómetro del tablero en vivo de Zertoo Orders y reportes
// de tiempos después. Los estados sin timestamp propio (ej. CANCELLED) no
// aparecen acá a propósito.
const STATUS_TIMESTAMP_FIELD: Partial<Record<z.infer<typeof schema>["status"], string>> = {
  ACCEPTED: "acceptedAt",
  PREPARING: "preparingAt",
  READY: "readyAt",
  REJECTED: "rejectedAt",
  COMPLETED: "completedAt",
};

// PATCH /api/menu-orders/[id] — el negocio avanza el pedido por sus estados.
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await requirePermission("ORDERS");
  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: "Estado inválido" }, { status: 400 });

  const existing = await db.menuOrder.findFirst({
    where: { id: params.id, tenantId: session.tenantId },
    include: { tenant: true, location: true },
  });
  if (!existing) return NextResponse.json({ error: "No encontrado" }, { status: 404 });

  const timestampField = STATUS_TIMESTAMP_FIELD[parsed.data.status];
  const order = await db.menuOrder.update({
    where: { id: params.id },
    data: { status: parsed.data.status, ...(timestampField ? { [timestampField]: new Date() } : {}) },
    include: { items: true },
  });

  // Con varias ubicaciones, "tu pedido en {negocio}" a secas sería
  // ambiguo — se usa el nombre de la location del pedido cuando existe.
  const businessName = existing.location ? `${existing.tenant.name} - ${existing.location.name}` : existing.tenant.name;

  // Avisos al CLIENTE por WhatsApp — no deben tumbar el cambio de
  // estado si Twilio falla, solo queda logueado (mismo criterio que
  // /api/public/menu-orders).
  if (parsed.data.status === "ACCEPTED" && parsed.data.etaMinutes) {
    await sendOrderConfirmedWithEtaWhatsApp({
      toPhone: order.customerPhone,
      customerName: order.customerName,
      businessName,
      etaMinutes: parsed.data.etaMinutes,
      language: order.language,
    }).catch((err) => console.error("No se pudo avisar la confirmación por WhatsApp:", err));
  } else if (parsed.data.status === "READY") {
    const notes = READY_FULFILLMENT_NOTE[order.language] ?? READY_FULFILLMENT_NOTE.es;
    await sendOrderReadyWhatsApp({
      toPhone: order.customerPhone,
      customerName: order.customerName,
      businessName,
      fulfillmentNote: notes[order.fulfillment],
      language: order.language,
    }).catch((err) => console.error("No se pudo avisar que el pedido está listo por WhatsApp:", err));
  }

  return NextResponse.json({ order });
}
