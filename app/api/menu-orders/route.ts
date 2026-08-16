import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireTenant } from "@/lib/auth";

// GET /api/menu-orders — pedidos del negocio autenticado, más recientes primero.
export async function GET() {
  const session = await requireTenant();
  const orders = await db.menuOrder.findMany({
    where: { tenantId: session.tenantId },
    include: { items: true },
    orderBy: { createdAt: "desc" },
    take: 200,
  });
  return NextResponse.json({ orders });
}
