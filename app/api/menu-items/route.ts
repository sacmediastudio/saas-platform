import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireTenant } from "@/lib/auth";

const createSchema = z.object({
  categoryId: z.string(),
  name: z.string().min(1),
  description: z.string().optional(),
  price: z.number().positive(),
  imageUrl: z.string().min(1).optional(), // acepta URL http(s) o data URI (foto subida por el usuario)
  featured: z.boolean().default(false),
  allergens: z.array(z.string()).default([]),
});

// GET /api/menu-items — lista los platos del tenant autenticado, agrupados
// implícitamente por categoría (el frontend agrupa por categoryId).
export async function GET() {
  const session = await requireTenant();

  const items = await db.menuItem.findMany({
    where: { tenantId: session.tenantId },
    include: { category: true },
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

  const item = await db.menuItem.create({
    data: {
      tenantId: session.tenantId, // nunca viene del body
      ...parsed.data,
    },
  });

  return NextResponse.json({ item }, { status: 201 });
}
