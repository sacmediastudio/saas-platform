import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/auth";
import { withAuthErrors } from "@/lib/api-route";

const schema = z.object({ ids: z.array(z.string().min(1)).min(1).max(200) });

// POST /api/menu-categories/reorder — recibe TODAS las categorías del
// negocio en el orden nuevo y les reescribe sortOrder = 0..n-1. Se manda
// la lista completa (no un intercambio de dos) para que los valores
// repetidos que pudieran haber quedado al borrar categorías se corrijan
// de una vez y el orden sea siempre determinista.
export function POST(req: NextRequest) {
  return withAuthErrors(async () => {
    const session = await requirePermission("MENU");
    const parsed = schema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: "Datos inválidos" }, { status: 400 });

    const { ids } = parsed.data;
    const owned = await db.menuCategory.findMany({ where: { tenantId: session.tenantId }, select: { id: true } });
    const ownedIds = new Set(owned.map((c) => c.id));
    if (new Set(ids).size !== ids.length || ids.length !== ownedIds.size || !ids.every((id) => ownedIds.has(id))) {
      return NextResponse.json({ error: "La lista de categorías no coincide con las del negocio." }, { status: 400 });
    }

    await db.$transaction(
      ids.map((id, index) => db.menuCategory.update({ where: { id }, data: { sortOrder: index } }))
    );
    return NextResponse.json({ ok: true });
  });
}
