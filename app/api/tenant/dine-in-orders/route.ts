import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/auth";
import { requireModuleEnabled } from "@/lib/modules";
import { buildOrderItems } from "@/lib/order-builder";

// Zertoo Waiter (orders.zertoo.app) llama a esto cross-origin cuando un
// mesero manda un pedido a cocina — misma cookie de sesión compartida
// de `.zertoo.app` que ya usa el resto de Fase 1/2.
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
  tableId: z.string().min(1),
  waiterId: z.string().min(1),
  notes: z.string().max(300).optional(),
  items: z
    .array(
      z.object({
        menuItemId: z.string(),
        quantity: z.number().int().min(1).max(50),
        addOnIds: z.array(z.string()).max(20).optional(),
        notes: z.string().max(200).optional(),
      })
    )
    .min(1)
    .max(50),
});

// POST /api/tenant/dine-in-orders — "Enviar a cocina" desde Zertoo
// Waiter (Fase 2). A diferencia de /api/public/menu-orders (que un
// cliente arma solo, sin identidad de staff), acá el pedido lo arma un
// mesero ya "fichado" con su PIN — llega directo en ACCEPTED (un
// mesero tipeándolo YA es la aceptación, no hace falta que alguien más
// lo revise en "Nuevos"), sin avisos por WhatsApp al cliente (no hay
// teléfono real) ni al negocio (el mesero que lo creó ya lo sabe).
export async function POST(req: NextRequest) {
  const session = await requirePermission("WAITER");
  await requireModuleEnabled(session.tenantId, "ORDERS");

  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Datos inválidos" }, { status: 400, headers: CORS_HEADERS });
  }
  const data = parsed.data;

  const table = await db.restaurantTable.findFirst({ where: { id: data.tableId, tenantId: session.tenantId } });
  if (!table) return NextResponse.json({ error: "Mesa no encontrada" }, { status: 400, headers: CORS_HEADERS });

  // El "fichado" (PIN) pasa del lado de Zertoo Waiter, pero el
  // waiterId que llega acá se valida de nuevo del lado del servidor:
  // tiene que ser un User real de este tenant con permiso WAITER —
  // nunca se confía ciegamente en lo que mande el cliente.
  const waiter = await db.user.findFirst({ where: { id: data.waiterId, tenantId: session.tenantId } });
  if (!waiter || (waiter.role !== "OWNER" && !waiter.permissions.includes("WAITER"))) {
    return NextResponse.json({ error: "Mesero inválido" }, { status: 400, headers: CORS_HEADERS });
  }

  const built = await buildOrderItems(session.tenantId, data.items);
  if (!built.ok) {
    return NextResponse.json({ error: built.error }, { status: 400, headers: CORS_HEADERS });
  }

  const order = await db.menuOrder.create({
    data: {
      tenantId: session.tenantId,
      tableId: table.id,
      waiterId: waiter.id,
      fulfillment: "DINE_IN",
      customerName: table.name,
      customerEmail: "",
      customerPhone: "",
      notes: data.notes,
      status: "ACCEPTED",
      acceptedAt: new Date(),
      subtotal: built.subtotal,
      deliveryFee: 0,
      total: built.subtotal,
      items: { create: built.items },
    },
    include: { items: true },
  });

  return NextResponse.json({ order }, { status: 201, headers: CORS_HEADERS });
}
