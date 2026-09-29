import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/auth";
import { requireModuleEnabled } from "@/lib/modules";
import { buildStationTickets } from "@/lib/print-routing";

// El tablero en vivo (orders.zertoo.app) llama a esto cross-origin
// para mostrar a qué estación va cada línea — mismo criterio de CORS
// que PATCH /api/menu-orders/[id].
const ALLOWED_ORIGIN = process.env.ORDERS_APP_ORIGIN || "https://orders.zertoo.app";
const CORS_HEADERS = {
  "Access-Control-Allow-Origin": ALLOWED_ORIGIN,
  "Access-Control-Allow-Credentials": "true",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

// GET /api/tenant/order-print-tickets/[id] — desglose por estación de
// un pedido ya aceptado, listo para que el Print Bridge (ítem 5,
// todavía no construido) lo consuma. Por ahora también sirve para que
// el tablero en vivo muestre a qué estación va cada línea.
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const session = await requirePermission("ORDERS");
  await requireModuleEnabled(session.tenantId, "ORDERS");

  const order = await db.menuOrder.findFirst({
    where: { id: params.id, tenantId: session.tenantId },
    include: { items: true },
  });
  if (!order) return NextResponse.json({ error: "Pedido no encontrado" }, { status: 404, headers: CORS_HEADERS });

  const stationIds = [...new Set(order.items.map((i) => i.stationId).filter((id): id is string => Boolean(id)))];
  const stations = stationIds.length
    ? await db.preparationStation.findMany({ where: { id: { in: stationIds }, tenantId: session.tenantId } })
    : [];
  const stationNamesById = new Map(stations.map((s) => [s.id, s.name]));

  const tickets = buildStationTickets(order.items, stationNamesById);
  return NextResponse.json({ tickets }, { headers: CORS_HEADERS });
}
