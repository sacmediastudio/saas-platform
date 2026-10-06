import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/auth";
import { sendOrderConfirmedWithEtaWhatsApp, sendOrderReadyWhatsApp } from "@/lib/whatsapp";
import { withAuthErrors } from "@/lib/api-route";

// El tablero en vivo de Zertoo Orders (orders.zertoo.app) llama a este
// endpoint cross-origin para avanzar el estado de un pedido, reusando
// esta misma lógica (avisos por WhatsApp incluidos) en vez de
// duplicarla allá. La sesión llega vía la cookie compartida de
// `.zertoo.app` (ver Fase 0) — por eso hace falta `credentials`.
const ALLOWED_ORIGIN = process.env.ORDERS_APP_ORIGIN || "https://orders.zertoo.app";
const CORS_HEADERS = {
  "Access-Control-Allow-Origin": ALLOWED_ORIGIN,
  "Access-Control-Allow-Credentials": "true",
  "Access-Control-Allow-Methods": "PATCH, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

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
  return withAuthErrors(async () => {
    const session = await requirePermission("ORDERS");
    const parsed = schema.safeParse(await req.json());
    if (!parsed.success) return NextResponse.json({ error: "Estado inválido" }, { status: 400, headers: CORS_HEADERS });

    const existing = await db.menuOrder.findFirst({
      where: { id: params.id, tenantId: session.tenantId },
      include: { tenant: true, location: true },
    });
    if (!existing) return NextResponse.json({ error: "No encontrado" }, { status: 404, headers: CORS_HEADERS });

    // Ningún pedido puede completarse sin cobrarse: el único camino a
    // COMPLETED es el endpoint de cobro (POST /api/tenant/menu-orders/[id]/
    // payments), que además deja el recibo en cola. Este PATCH sigue
    // sirviendo para el resto de las transiciones (aceptar/preparar/listo/
    // rechazar/cancelar).
    if (parsed.data.status === "COMPLETED" && !existing.paidAt) {
      return NextResponse.json({ error: "Cobrá el pedido antes de completarlo." }, { status: 400, headers: CORS_HEADERS });
    }

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
    // /api/public/menu-orders). No aplica a DINE_IN (Fase 2): ahí no hay
    // un teléfono de cliente real que avisar, el mesero está presente.
    if (order.fulfillment !== "DINE_IN" && parsed.data.status === "ACCEPTED" && parsed.data.etaMinutes) {
      await sendOrderConfirmedWithEtaWhatsApp({
        toPhone: order.customerPhone,
        customerName: order.customerName,
        businessName,
        etaMinutes: parsed.data.etaMinutes,
        language: order.language,
      }).catch((err) => console.error("No se pudo avisar la confirmación por WhatsApp:", err));
    } else if (order.fulfillment !== "DINE_IN" && parsed.data.status === "READY") {
      const notes = READY_FULFILLMENT_NOTE[order.language] ?? READY_FULFILLMENT_NOTE.es;
      await sendOrderReadyWhatsApp({
        toPhone: order.customerPhone,
        customerName: order.customerName,
        businessName,
        fulfillmentNote: notes[order.fulfillment],
        language: order.language,
      }).catch((err) => console.error("No se pudo avisar que el pedido está listo por WhatsApp:", err));
    }

    return NextResponse.json({ order }, { headers: CORS_HEADERS });
  }, CORS_HEADERS);
}
