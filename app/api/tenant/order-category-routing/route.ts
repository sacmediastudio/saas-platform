import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/auth";
import { requireModuleEnabled } from "@/lib/modules";

const updateSchema = z.object({
  categoryId: z.string().min(1),
  stationId: z.string().nullable(),
});

// GET /api/tenant/order-category-routing — categorías del menú con su
// estación asignada (si tiene), para la tabla de Category Routing.
export async function GET() {
  const session = await requirePermission("ORDERS");
  await requireModuleEnabled(session.tenantId, "ORDERS");
  const categories = await db.menuCategory.findMany({
    where: { tenantId: session.tenantId },
    select: { id: true, name: true, stationId: true },
    orderBy: { sortOrder: "asc" },
  });
  return NextResponse.json({ categories });
}

// PATCH /api/tenant/order-category-routing — asigna (o quita) la estación
// de una categoría. Vive acá, gateado por ORDERS, en vez de en
// /api/menu-categories (gateado por MENU) porque enrutar a una estación
// es una decisión operativa de Orders, no una edición del menú en sí.
export async function PATCH(req: NextRequest) {
  const session = await requirePermission("ORDERS");
  await requireModuleEnabled(session.tenantId, "ORDERS");
  const parsed = updateSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const category = await db.menuCategory.findFirst({
    where: { id: parsed.data.categoryId, tenantId: session.tenantId },
  });
  if (!category) return NextResponse.json({ error: "Categoría no encontrada" }, { status: 404 });

  if (parsed.data.stationId) {
    const station = await db.preparationStation.findFirst({
      where: { id: parsed.data.stationId, tenantId: session.tenantId },
    });
    if (!station) return NextResponse.json({ error: "Estación no encontrada" }, { status: 400 });
  }

  const updated = await db.menuCategory.update({
    where: { id: parsed.data.categoryId },
    data: { stationId: parsed.data.stationId },
    select: { id: true, name: true, stationId: true },
  });

  return NextResponse.json({ category: updated });
}
