import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/auth";
import { requireModuleEnabled } from "@/lib/modules";
import { withAuthErrors } from "@/lib/api-route";

// Zertoo Waiter llama a esto cross-origin cuando el mesero cobra una
// mesa — mismo patrón CORS que el resto de las rutas de dine-in-orders.
const ALLOWED_ORIGIN = process.env.ORDERS_APP_ORIGIN || "https://orders.zertoo.app";
const CORS_HEADERS = {
  "Access-Control-Allow-Origin": ALLOWED_ORIGIN,
  "Access-Control-Allow-Credentials": "true",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

const schema = z.object({
  payments: z
    .array(
      z.object({
        method: z.enum(["CASH", "CARD"]),
        amount: z.number().positive(),
      })
    )
    .min(1)
    .max(20),
});

const EPSILON = 0.01;

// POST /api/tenant/dine-in-orders/[id]/payments — cobra una mesa. Sirve
// tanto para "una sola forma de pago por el total" como para split
// check: cada parte del split llama a este mismo endpoint por separado
// y es aditivo contra lo ya cobrado (OrderPayment), así un split a
// medio pagar sobrevive cerrar y reabrir la hoja de cobro en la app.
// Al llegar al total, transiciona el pedido a COMPLETED — es el ÚNICO
// camino por el que una mesa (DINE_IN) puede completarse, ver el candado
// en PATCH /api/menu-orders/[id].
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  return withAuthErrors(async () => {
    const session = await requirePermission("WAITER");
    await requireModuleEnabled(session.tenantId, "ORDERS");

    const parsed = schema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ error: "Datos inválidos" }, { status: 400, headers: CORS_HEADERS });
    }

    const order = await db.menuOrder.findFirst({
      where: { id: params.id, tenantId: session.tenantId, fulfillment: "DINE_IN" },
      include: { payments: true },
    });
    if (!order) return NextResponse.json({ error: "Mesa no encontrada" }, { status: 404, headers: CORS_HEADERS });
    if (order.paidAt) {
      return NextResponse.json({ error: "Esta mesa ya está pagada." }, { status: 400, headers: CORS_HEADERS });
    }
    if (order.status === "REJECTED" || order.status === "CANCELLED") {
      return NextResponse.json({ error: "Este pedido ya no está activo." }, { status: 400, headers: CORS_HEADERS });
    }

    const alreadyPaid = order.payments.reduce((sum, p) => sum + p.amount, 0);
    const newAmount = parsed.data.payments.reduce((sum, p) => sum + p.amount, 0);
    if (alreadyPaid + newAmount > order.total + EPSILON) {
      return NextResponse.json({ error: "El monto supera el total de la mesa." }, { status: 400, headers: CORS_HEADERS });
    }

    const fullyPaid = alreadyPaid + newAmount >= order.total - EPSILON;
    const updated = await db.$transaction(async (tx) => {
      await tx.orderPayment.createMany({
        data: parsed.data.payments.map((p) => ({ orderId: order.id, method: p.method, amount: p.amount })),
      });
      return tx.menuOrder.update({
        where: { id: order.id },
        data: fullyPaid ? { paidAt: new Date(), status: "COMPLETED", completedAt: new Date() } : {},
        include: { items: true, payments: true },
      });
    });

    return NextResponse.json({ order: updated }, { headers: CORS_HEADERS });
  }, CORS_HEADERS);
}
