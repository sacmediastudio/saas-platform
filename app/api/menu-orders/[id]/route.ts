import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireTenant } from "@/lib/auth";
import { sendOrderConfirmedWithEtaWhatsApp, sendOrderReadyWhatsApp } from "@/lib/whatsapp";

const schema = z.object({
  status: z.enum(["PENDING", "CONFIRMED", "READY", "COMPLETED", "CANCELLED"]),
  // Solo se usa (y se exige en el frontend) al confirmar — es lo que le
  // permite al negocio avisarle al cliente "listo en X minutos".
  etaMinutes: z.number().int().min(1).max(180).optional(),
});

const READY_FULFILLMENT_NOTE: Record<string, Record<"PICKUP" | "DELIVERY", string>> = {
  es: { PICKUP: "Podés pasar a retirarlo cuando quieras.", DELIVERY: "Ya va en camino." },
  en: { PICKUP: "You can come pick it up anytime.", DELIVERY: "It's on its way." },
};

// PATCH /api/menu-orders/[id] — el negocio avanza el pedido por sus estados.
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await requireTenant();
  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: "Estado inválido" }, { status: 400 });

  const existing = await db.menuOrder.findFirst({
    where: { id: params.id, tenantId: session.tenantId },
    include: { tenant: true },
  });
  if (!existing) return NextResponse.json({ error: "No encontrado" }, { status: 404 });

  const order = await db.menuOrder.update({
    where: { id: params.id },
    data: { status: parsed.data.status },
    include: { items: true },
  });

  // Avisos al CLIENTE por WhatsApp — no deben tumbar el cambio de
  // estado si Twilio falla, solo queda logueado (mismo criterio que
  // /api/public/menu-orders).
  if (parsed.data.status === "CONFIRMED" && parsed.data.etaMinutes) {
    await sendOrderConfirmedWithEtaWhatsApp({
      toPhone: order.customerPhone,
      customerName: order.customerName,
      businessName: existing.tenant.name,
      etaMinutes: parsed.data.etaMinutes,
      language: order.language,
    }).catch((err) => console.error("No se pudo avisar la confirmación por WhatsApp:", err));
  } else if (parsed.data.status === "READY") {
    const notes = READY_FULFILLMENT_NOTE[order.language] ?? READY_FULFILLMENT_NOTE.es;
    await sendOrderReadyWhatsApp({
      toPhone: order.customerPhone,
      customerName: order.customerName,
      businessName: existing.tenant.name,
      fulfillmentNote: notes[order.fulfillment],
      language: order.language,
    }).catch((err) => console.error("No se pudo avisar que el pedido está listo por WhatsApp:", err));
  }

  return NextResponse.json({ order });
}
