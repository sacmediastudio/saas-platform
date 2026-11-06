import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/auth";
import { withAuthErrors } from "@/lib/api-route";

const MAX_WAITERS = 30;

const createSchema = z.object({
  name: z.string().trim().min(1).max(60),
  photoUrl: z.string().url().max(500).nullable().optional(),
});

// POST /api/tenant/waiters — agrega un mesero a calificar.
export function POST(req: NextRequest) {
  return withAuthErrors(async () => {
    const session = await requirePermission("REVIEWS");
    const parsed = createSchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: "Datos inválidos" }, { status: 400 });

    const count = await db.serviceWaiter.count({ where: { tenantId: session.tenantId } });
    if (count >= MAX_WAITERS) {
      return NextResponse.json({ error: `Máximo ${MAX_WAITERS} meseros.` }, { status: 400 });
    }

    const last = await db.serviceWaiter.aggregate({ where: { tenantId: session.tenantId }, _max: { sortOrder: true } });
    const waiter = await db.serviceWaiter.create({
      data: {
        tenantId: session.tenantId,
        name: parsed.data.name,
        photoUrl: parsed.data.photoUrl ?? null,
        sortOrder: (last._max.sortOrder ?? -1) + 1,
      },
    });
    return NextResponse.json({ waiter }, { status: 201 });
  });
}
