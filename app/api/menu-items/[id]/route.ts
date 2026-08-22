import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireTenant } from "@/lib/auth";

const addOnSchema = z.object({ name: z.string().min(1).max(60), price: z.number().min(0).max(10000) });

const updateSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional(),
  descriptionEn: z.string().nullable().optional(),
  price: z.number().min(0).optional(),
  variablePrice: z.boolean().optional(),
  status: z.enum(["AVAILABLE", "SOLD_OUT", "SEASONAL"]).optional(),
  categoryId: z.string().optional(),
  imageUrl: z.string().min(1).nullable().optional(),
  featured: z.boolean().optional(),
  addOns: z.array(addOnSchema).max(30).optional(),
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

  // El precio solo es obligatorio (> 0) si el plato NO tiene precio
  // variable — se valida acá, no en el schema de zod, porque en una
  // edición parcial cualquiera de los dos campos puede venir ausente
  // (significa "no cambia"), así que hace falta mirar el valor
  // efectivo combinando lo nuevo con lo que ya había guardado.
  const effectiveVariablePrice = parsed.data.variablePrice ?? existing.variablePrice;
  const effectivePrice = parsed.data.price ?? Number(existing.price);
  if (!effectiveVariablePrice && effectivePrice <= 0) {
    return NextResponse.json(
      { error: "El precio debe ser mayor a 0 (o marca 'Precio variable')" },
      { status: 400 }
    );
  }

  if (parsed.data.categoryId) {
    const category = await db.menuCategory.findFirst({
      where: { id: parsed.data.categoryId, tenantId: session.tenantId },
    });
    if (!category) {
      return NextResponse.json({ error: "Categoría no encontrada" }, { status: 404 });
    }
  }

  const { addOns, ...itemData } = parsed.data;

  // Simplemente se borran y se recrean — los pedidos ya hechos guardan
  // su propia copia (nombre + precio) de los add-ons que eligieron en
  // su momento, así que borrar/recrear acá no altera pedidos pasados.
  if (addOns !== undefined) {
    await db.menuItemAddOn.deleteMany({ where: { menuItemId: params.id } });
  }

  const item = await db.menuItem.update({
    where: { id: params.id },
    data: {
      ...itemData,
      ...(addOns !== undefined ? { addOns: { create: addOns.map((a, i) => ({ ...a, sortOrder: i })) } } : {}),
    },
    include: { addOns: true },
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
