import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireTenant } from "@/lib/auth";

const schema = z.object({ status: z.enum(["PENDING", "CONFIRMED", "READY", "COMPLETED", "CANCELLED"]) });

// PATCH /api/menu-orders/[id] — el negocio avanza el pedido por sus estados.
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await requireTenant();
  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: "Estado inválido" }, { status: 400 });

  const existing = await db.menuOrder.findFirst({ where: { id: params.id, tenantId: session.tenantId } });
  if (!existing) return NextResponse.json({ error: "No encontrado" }, { status: 404 });

  const order = await db.menuOrder.update({
    where: { id: params.id },
    data: { status: parsed.data.status },
    include: { items: true },
  });

  return NextResponse.json({ order });
}
