import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireTenant } from "@/lib/auth";

const rowSchema = z
  .object({
    categoria: z.string().min(1),
    nombre: z.string().min(1),
    descripcion: z.string().optional(),
    descripcionEn: z.string().optional(),
    precio: z.number().min(0),
    variablePrice: z.boolean().default(false),
    destacado: z.boolean().default(false),
  })
  .refine((data) => data.variablePrice || data.precio > 0, {
    message: "El precio debe ser mayor a 0 (o marcarse como variable)",
    path: ["precio"],
  });

const schema = z.object({ rows: z.array(rowSchema).min(1).max(500) });

// POST /api/menu-items/import/confirm — recibe las filas YA validadas
// por el preview (no vuelve a leer el archivo) y crea todo de verdad:
// las categorías que no existan todavía, y los platos dentro de ellas.
export async function POST(req: NextRequest) {
  const session = await requireTenant();
  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Datos inválidos" }, { status: 400 });
  }
  const { rows } = parsed.data;

  const existingCategories = await db.menuCategory.findMany({ where: { tenantId: session.tenantId } });
  // Comparación sin importar mayúsculas/espacios — para que "Postres"
  // y "postres " no generen dos categorías duplicadas por accidente.
  const normalize = (s: string) => s.trim().toLowerCase();
  const categoryByName = new Map(existingCategories.map((c) => [normalize(c.name), c]));

  const uniqueCategoryNames = [...new Set(rows.map((r) => r.categoria))];
  const newCategoryNames = uniqueCategoryNames.filter((name) => !categoryByName.has(normalize(name)));

  let created = 0;
  await db.$transaction(async (tx) => {
    let nextSortOrder = existingCategories.length;
    for (const name of newCategoryNames) {
      const category = await tx.menuCategory.create({
        data: { tenantId: session.tenantId, name, sortOrder: nextSortOrder },
      });
      categoryByName.set(normalize(name), category);
      nextSortOrder++;
    }

    // Cuántos platos ya tenía cada categoría ANTES de esta importación
    // — sin esto, todo lo importado nacería con el 0 por defecto del
    // esquema, y "subir"/"bajar" en el editor no tendría nada real que
    // intercambiar entre platos de la misma categoría.
    const existingCounts = await tx.menuItem.groupBy({
      by: ["categoryId"],
      where: { tenantId: session.tenantId },
      _count: { id: true },
    });
    const nextItemSortOrder = new Map(existingCounts.map((c) => [c.categoryId, c._count.id]));

    for (const row of rows) {
      const category = categoryByName.get(normalize(row.categoria));
      if (!category) continue; // no debería pasar, pero por las dudas no rompe la importación entera

      const sortOrder = nextItemSortOrder.get(category.id) ?? 0;
      nextItemSortOrder.set(category.id, sortOrder + 1);

      await tx.menuItem.create({
        data: {
          tenantId: session.tenantId,
          categoryId: category.id,
          name: row.nombre,
          description: row.descripcion || null,
          descriptionEn: row.descripcionEn || null,
          price: row.precio,
          variablePrice: row.variablePrice,
          featured: row.destacado,
          sortOrder,
        },
      });
      created++;
    }
  });

  return NextResponse.json({ created, categoriesCreated: newCategoryNames.length });
}
