import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireTenant } from "@/lib/auth";

const addOnSchema = z.object({ name: z.string().min(1).max(60), price: z.number().min(0).max(10000) });

const createSchema = z
  .object({
    categoryId: z.string(),
    name: z.string().min(1),
    description: z.string().optional(),
    descriptionEn: z.string().nullable().optional(),
    price: z.number().min(0),
    // Para platos por peso/tamaño — ver comentario en el schema de Prisma.
    variablePrice: z.boolean().default(false),
    imageUrl: z.string().min(1).nullable().optional(), // acepta URL http(s), data URI, null (sin foto), o ausente
    featured: z.boolean().default(false),
    allergens: z.array(z.string()).default([]),
    addOns: z.array(addOnSchema).max(30).default([]),
  })
  .refine((data) => data.variablePrice || data.price > 0, {
    message: "El precio debe ser mayor a 0 (o marca 'Precio variable')",
    path: ["price"],
  });

// GET /api/menu-items — lista los platos del tenant autenticado, agrupados
// implícitamente por categoría (el frontend agrupa por categoryId).
export async function GET() {
  const session = await requireTenant();

  const items = await db.menuItem.findMany({
    where: { tenantId: session.tenantId },
    include: { category: true, addOns: { orderBy: { sortOrder: "asc" } } },
    orderBy: [{ categoryId: "asc" }, { sortOrder: "asc" }],
  });

  return NextResponse.json({ items });
}

// POST /api/menu-items — crea un plato nuevo dentro del tenant actual.
export async function POST(req: NextRequest) {
  const session = await requireTenant();
  const body = await req.json();
  const parsed = createSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { addOns, ...itemData } = parsed.data;

  // Sin esto, todo plato nuevo nace con el 0 por defecto del esquema —
  // y si TODOS los platos de una categoría comparten el mismo valor,
  // "subir"/"bajar" no tiene nada que intercambiar de verdad.
  const existingCount = await db.menuItem.count({
    where: { tenantId: session.tenantId, categoryId: itemData.categoryId },
  });

  const item = await db.menuItem.create({
    data: {
      tenantId: session.tenantId, // nunca viene del body
      ...itemData,
      sortOrder: existingCount,
      addOns: { create: addOns.map((a, i) => ({ ...a, sortOrder: i })) },
    },
    include: { addOns: true },
  });

  return NextResponse.json({ item }, { status: 201 });
}
