import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/auth";
import { requireModuleEnabled } from "@/lib/modules";

const updateSchema = z.object({
  name: z.string().min(1).max(60),
});

async function findOwnedStation(tenantId: string, id: string) {
  return db.preparationStation.findFirst({ where: { id, tenantId } });
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await requirePermission("ORDERS");
  await requireModuleEnabled(session.tenantId, "ORDERS");
  const existing = await findOwnedStation(session.tenantId, params.id);
  if (!existing) return NextResponse.json({ error: "Estación no encontrada" }, { status: 404 });

  const parsed = updateSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const station = await db.preparationStation.update({
    where: { id: params.id },
    data: { name: parsed.data.name },
  });
  return NextResponse.json({ station });
}

// Borrar una estación no está bloqueado por tener impresoras/categorías
// apuntándole — onDelete: SetNull en el schema las deja sin asignar,
// no las borra ni rompe nada.
export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await requirePermission("ORDERS");
  await requireModuleEnabled(session.tenantId, "ORDERS");
  const existing = await findOwnedStation(session.tenantId, params.id);
  if (!existing) return NextResponse.json({ error: "Estación no encontrada" }, { status: 404 });

  await db.preparationStation.delete({ where: { id: params.id } });
  return NextResponse.json({ ok: true });
}
