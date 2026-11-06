import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/auth";
import { withAuthErrors } from "@/lib/api-route";

const schema = z.object({ ids: z.array(z.string().min(1)).min(1).max(100) });

// Recibe TODOS los meseros en el orden nuevo (igual que las categorías).
export function POST(req: NextRequest) {
  return withAuthErrors(async () => {
    const session = await requirePermission("REVIEWS");
    const parsed = schema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: "Datos inválidos" }, { status: 400 });

    const { ids } = parsed.data;
    const owned = await db.serviceWaiter.findMany({ where: { tenantId: session.tenantId }, select: { id: true } });
    const ownedIds = new Set(owned.map((w) => w.id));
    if (new Set(ids).size !== ids.length || ids.length !== ownedIds.size || !ids.every((id) => ownedIds.has(id))) {
      return NextResponse.json({ error: "La lista no coincide con tus meseros." }, { status: 400 });
    }

    await db.$transaction(ids.map((id, index) => db.serviceWaiter.update({ where: { id }, data: { sortOrder: index } })));
    return NextResponse.json({ ok: true });
  });
}
