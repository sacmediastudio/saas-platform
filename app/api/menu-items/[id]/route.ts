import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireTenant } from "@/lib/auth";

const updateSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional(),
  descriptionEn: z.string().nullable().optional(),
  price: z.number().positive().optional(),
  status: z.enum(["AVAILABLE", "SOLD_OUT", "SEASONAL"]).optional(),
  categoryId: z.string().optional(),
  imageUrl: z.string().min(1).nullable().optional(),
  featured: z.boolean().optional(),
});

async function findOwnedItem(tenantId: string, id: string) {
  // where compuesto: filtra por tenantId además del id, así una URL
  // adivinada por otro tenant simplemente no encuentra el registro
  // en vez de exponer un 403 que confirme que el id existe.
  return db.menuItem.findFirst({ where: { id, tenantId } });
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await requireTenant();
  const existing = await findOwnedItem(session.tenantId, params.id);
  if (!existing) {
    return NextResponse.json({ error: "Plato no encontrado" }, { status: 404 });
  }

  const body = await req.json();
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  if (parsed.data.categoryId) {
    const category = await db.menuCategory.findFirst({
      where: { id: parsed.data.categoryId, tenantId: session.tenantId },
    });
    if (!category) {
      return NextResponse.json({ error: "Categoría no encontrada" }, { status: 404 });
    }
  }

  const item = await db.menuItem.update({
    where: { id: params.id },
    data: parsed.data,
  });

  return NextResponse.json({ item });
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await requireTenant();
  const existing = await findOwnedItem(session.tenantId, params.id);
  if (!existing) {
    return NextResponse.json({ error: "Plato no encontrado" }, { status: 404 });
  }

  await db.menuItem.delete({ where: { id: params.id } });
  return NextResponse.json({ ok: true });
}
