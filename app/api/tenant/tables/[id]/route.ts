import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/auth";
import { requireModuleEnabled } from "@/lib/modules";

const updateSchema = z.object({
  name: z.string().min(1).max(60).optional(),
  zone: z.string().max(60).nullable().optional(),
  seats: z.number().int().min(1).max(100).nullable().optional(),
});

async function findOwnedTable(tenantId: string, id: string) {
  return db.restaurantTable.findFirst({ where: { id, tenantId } });
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await requirePermission("ORDERS");
  await requireModuleEnabled(session.tenantId, "ORDERS");
  const existing = await findOwnedTable(session.tenantId, params.id);
  if (!existing) return NextResponse.json({ error: "Mesa no encontrada" }, { status: 404 });

  const parsed = updateSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const table = await db.restaurantTable.update({ where: { id: params.id }, data: parsed.data });
  return NextResponse.json({ table });
}

// Borrar una mesa con un pedido dine-in abierto no está bloqueado —
// onDelete: SetNull en el schema deja ese pedido sin mesa asignada, no
// lo borra ni rompe el tablero en vivo.
export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await requirePermission("ORDERS");
  await requireModuleEnabled(session.tenantId, "ORDERS");
  const existing = await findOwnedTable(session.tenantId, params.id);
  if (!existing) return NextResponse.json({ error: "Mesa no encontrada" }, { status: 404 });

  await db.restaurantTable.delete({ where: { id: params.id } });
  return NextResponse.json({ ok: true });
}
