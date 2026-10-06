import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "./db";
import { requireTenant, requirePermission } from "./auth";
import { requireModuleEnabled } from "./modules";
import { withAuthErrors } from "./api-route";

// Zertoo Orders (orders.zertoo.app / la app nativa) llama a estas rutas;
// mismo patrón CORS que el resto de /api/tenant/* de Orders.
const ALLOWED_ORIGIN = process.env.ORDERS_APP_ORIGIN || "https://orders.zertoo.app";
export const ORDER_PAYMENT_CORS = {
  "Access-Control-Allow-Origin": ALLOWED_ORIGIN,
  "Access-Control-Allow-Credentials": "true",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export function orderPaymentOptions() {
  return new NextResponse(null, { status: 204, headers: ORDER_PAYMENT_CORS });
}

const EPSILON = 0.01;

const paymentsSchema = z.object({
  payments: z
    .array(
      z.object({
        method: z.enum(["CASH", "CARD"]),
        amount: z.number().positive(),
        // Solo efectivo: lo que entregó el cliente (para calcular el cambio).
        tendered: z.number().positive().optional(),
      })
    )
    .min(1)
    .max(20),
});

function json(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: ORDER_PAYMENT_CORS });
}

// Una mesa la cobra quien tiene WAITER; un pedido de pickup/delivery,
// quien tiene ORDERS (no hay mesero de por medio).
async function requireOrderAccess(orderId: string) {
  const base = await requireTenant();
  const order = await db.menuOrder.findFirst({
    where: { id: orderId, tenantId: base.tenantId },
    include: { payments: true },
  });
  if (!order) return { ok: false as const, response: json({ error: "Pedido no encontrado" }, 404) };
  const session = await requirePermission(order.fulfillment === "DINE_IN" ? "WAITER" : "ORDERS");
  await requireModuleEnabled(session.tenantId, "ORDERS");
  return { ok: true as const, session, order };
}

/**
 * POST .../payments — cobra un pedido (cualquier tipo). Una sola llamada
 * sirve para pagar todo con una forma de pago o para un split (cada parte
 * llama por separado, es aditivo contra lo ya cobrado). Al llegar al
 * total transiciona a COMPLETED y deja el recibo en cola de impresión —
 * es el ÚNICO camino por el que un pedido puede completarse (ver el
 * candado de PATCH /api/menu-orders/[id]).
 */
export function handleOrderPayment(req: NextRequest, orderId: string) {
  return withAuthErrors(async () => {
    const parsed = paymentsSchema.safeParse(await req.json());
    if (!parsed.success) return json({ error: "Datos inválidos" }, 400);

    const access = await requireOrderAccess(orderId);
    if (!access.ok) return access.response;
    const { order } = access;

    if (order.paidAt) return json({ error: "Este pedido ya está pagado." }, 400);
    if (order.status === "REJECTED" || order.status === "CANCELLED") {
      return json({ error: "Este pedido ya no está activo." }, 400);
    }

    for (const p of parsed.data.payments) {
      if (p.tendered !== undefined && (p.method !== "CASH" || p.tendered < p.amount - EPSILON)) {
        return json({ error: "El efectivo recibido no puede ser menor al monto." }, 400);
      }
    }

    const alreadyPaid = order.payments.reduce((sum, p) => sum + p.amount, 0);
    const newAmount = parsed.data.payments.reduce((sum, p) => sum + p.amount, 0);
    if (alreadyPaid + newAmount > order.total + EPSILON) {
      return json({ error: "El monto supera el total del pedido." }, 400);
    }

    const fullyPaid = alreadyPaid + newAmount >= order.total - EPSILON;
    const updated = await db.$transaction(async (tx) => {
      await tx.orderPayment.createMany({
        data: parsed.data.payments.map((p) => ({
          orderId: order.id,
          method: p.method,
          amount: p.amount,
          tendered: p.method === "CASH" ? p.tendered ?? null : null,
        })),
      });
      return tx.menuOrder.update({
        where: { id: order.id },
        data: fullyPaid
          ? { paidAt: new Date(), status: "COMPLETED", completedAt: new Date(), receiptPrintPending: true }
          : {},
        include: { items: true, payments: true },
      });
    });

    return json({ order: updated });
  }, ORDER_PAYMENT_CORS);
}

/** POST .../receipt-print — vuelve a poner en cola el recibo de un pedido ya pagado. */
export function handleReceiptReprint(orderId: string) {
  return withAuthErrors(async () => {
    const access = await requireOrderAccess(orderId);
    if (!access.ok) return access.response;
    if (!access.order.paidAt) return json({ error: "El pedido todavía no está pagado." }, 400);

    await db.menuOrder.update({ where: { id: orderId }, data: { receiptPrintPending: true } });
    return json({ ok: true });
  }, ORDER_PAYMENT_CORS);
}
