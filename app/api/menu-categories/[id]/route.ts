import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireTenant } from "@/lib/auth";

const updateSchema = z.object({ name: z.string().min(1) });

async function findOwnedCategory(tenantId: string, id: string) {
  return db.menuCategory.findFirst({ where: { id, tenantId } });
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await requireTenant();
  const existing = await findOwnedCategory(session.tenantId, params.id);
  if (!existing) {
    return NextResponse.json({ error: "Categoría no encontrada" }, { status: 404 });
  }

  const parsed = updateSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const category = await db.menuCategory.update({
    where: { id: params.id },
    data: { name: parsed.data.name },
  });
  return NextResponse.json({ category });
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await requireTenant();
  const existing = await findOwnedCategory(session.tenantId, params.id);
  if (!existing) {
    return NextResponse.json({ error: "Categoría no encontrada" }, { status: 404 });
  }

  // No borramos en cascada por accidente: si todavía tiene platos dentro,
  // pedimos que primero los mueva o los borre. Evita que alguien pierda
  // platos sin darse cuenta al borrar una categoría.
  const itemCount = await db.menuItem.count({ where: { categoryId: params.id } });
  if (itemCount > 0) {
    return NextResponse.json(
      { error: `Esta categoría tiene ${itemCount} plato(s). Muévelos o bórralos primero.` },
      { status: 409 }
    );
  }

  await db.menuCategory.delete({ where: { id: params.id } });
  return NextResponse.json({ ok: true });
}
