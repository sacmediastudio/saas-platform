import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireTenant } from "@/lib/auth";

const schema = z.object({ orderedIds: z.array(z.string()).min(1) });

// POST /api/smartlink-items/reorder — recibe la lista completa de ids en
// el nuevo orden y actualiza sortOrder = índice para cada uno. Solo
// reordena ids que efectivamente pertenecen al tenant de la sesión.
export async function POST(req: NextRequest) {
  const session = await requireTenant();
  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const owned = await db.smartLinkItem.findMany({
    where: { tenantId: session.tenantId, id: { in: parsed.data.orderedIds } },
    select: { id: true },
  });
  const ownedIds = new Set(owned.map((o) => o.id));

  await db.$transaction(
    parsed.data.orderedIds
      .filter((id) => ownedIds.has(id))
      .map((id, index) => db.smartLinkItem.update({ where: { id }, data: { sortOrder: index } }))
  );

  return NextResponse.json({ ok: true });
}
