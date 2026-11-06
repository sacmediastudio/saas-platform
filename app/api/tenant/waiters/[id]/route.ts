import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/auth";
import { withAuthErrors } from "@/lib/api-route";

const updateSchema = z.object({
  name: z.string().trim().min(1).max(60).optional(),
  photoUrl: z.string().url().max(500).nullable().optional(),
  isActive: z.boolean().optional(),
});

export function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  return withAuthErrors(async () => {
    const session = await requirePermission("REVIEWS");
    const existing = await db.serviceWaiter.findFirst({ where: { id: params.id, tenantId: session.tenantId } });
    if (!existing) return NextResponse.json({ error: "No encontrado" }, { status: 404 });

    const parsed = updateSchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: "Datos inválidos" }, { status: 400 });

    const waiter = await db.serviceWaiter.update({ where: { id: params.id }, data: parsed.data });
    return NextResponse.json({ waiter });
  });
}

// Borrar un mesero borra también sus reseñas (cascade). Para conservar
// el historial, el dashboard ofrece desactivarlo en vez de borrarlo.
export function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  return withAuthErrors(async () => {
    const session = await requirePermission("REVIEWS");
    const existing = await db.serviceWaiter.findFirst({ where: { id: params.id, tenantId: session.tenantId } });
    if (!existing) return NextResponse.json({ error: "No encontrado" }, { status: 404 });
    await db.serviceWaiter.delete({ where: { id: params.id } });
    return NextResponse.json({ ok: true });
  });
}
