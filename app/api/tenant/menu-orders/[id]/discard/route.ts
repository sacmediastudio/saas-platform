import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/auth";
import { requireModuleEnabled } from "@/lib/modules";
import { withAuthErrors } from "@/lib/api-route";
import { hashPin } from "@/lib/pin";
import { rateLimit } from "@/lib/rate-limit";
import { ORDER_PAYMENT_CORS } from "@/lib/order-payments";

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: ORDER_PAYMENT_CORS });
}

const schema = z.object({ pin: z.string().regex(/^\d{4}$/) });

function json(body: Record<string, unknown>, status = 200) {
  return NextResponse.json(body, { status, headers: ORDER_PAYMENT_CORS });
}

// POST /api/tenant/menu-orders/[id]/discard — descarta un pedido que ya
// quedó LISTO y nadie vino a retirar. Pide el código (PIN de 4 dígitos)
// de un administrador del negocio (un usuario OWNER con PIN asignado
// desde Equipo), no el de quien tiene la tablet en la mano: así un
// empleado no puede borrar pedidos por su cuenta.
//
// No borra la fila: la pasa a CANCELLED, igual que cancelar desde el
// panel. Así sigue en el historial y en los reportes, y desaparece del
// tablero (que solo muestra NEW..READY). Solo aplica a pedidos de
// pickup/delivery en LISTO y sin ningún cobro registrado.
//
// Los errores del PIN devuelven 400 (no 401) a propósito: la app nativa
// trata cualquier 401 como "sesión vencida" y cierra sesión. Cada
// respuesta de error lleva un `code` estable para que la app la muestre
// en el idioma del dispositivo.
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  return withAuthErrors(async () => {
    const session = await requirePermission("ORDERS");
    await requireModuleEnabled(session.tenantId, "ORDERS");

    const parsed = schema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return json({ error: "Código inválido", code: "INVALID_PIN_FORMAT" }, 400);

    // 5 intentos cada 10 minutos por usuario: un PIN de 4 dígitos son
    // solo 10.000 combinaciones, sin freno se adivina rápido.
    const { allowed, retryAfterSeconds } = rateLimit(`discard:${session.userId}`, 5, 10 * 60_000);
    if (!allowed) {
      return NextResponse.json(
        { error: "Demasiados intentos. Espera unos minutos e intenta de nuevo.", code: "RATE_LIMITED" },
        { status: 429, headers: { ...ORDER_PAYMENT_CORS, "Retry-After": String(retryAfterSeconds) } }
      );
    }

    const admin = await db.user.findFirst({
      where: { tenantId: session.tenantId, role: "OWNER", pinHash: hashPin(parsed.data.pin) },
      select: { id: true },
    });
    if (!admin) return json({ error: "Código de administrador incorrecto", code: "WRONG_ADMIN_PIN" }, 400);

    const order = await db.menuOrder.findFirst({
      where: { id: params.id, tenantId: session.tenantId },
      include: { payments: { select: { id: true } } },
    });
    if (!order) return json({ error: "Pedido no encontrado", code: "NOT_FOUND" }, 404);
    if (order.fulfillment === "DINE_IN") {
      return json({ error: "Los pedidos de mesa no se descartan desde aquí.", code: "NOT_ALLOWED" }, 400);
    }
    if (order.status !== "READY") {
      return json({ error: "Solo se pueden descartar pedidos que estén listos.", code: "NOT_READY" }, 400);
    }
    if (order.paidAt || order.payments.length > 0) {
      return json({ error: "Este pedido ya tiene cobros registrados y no se puede descartar.", code: "HAS_PAYMENTS" }, 400);
    }

    await db.menuOrder.update({ where: { id: order.id }, data: { status: "CANCELLED" } });
    return json({ ok: true });
  }, ORDER_PAYMENT_CORS);
}
