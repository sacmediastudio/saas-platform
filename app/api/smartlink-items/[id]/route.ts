import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireTenant } from "@/lib/auth";

const updateSchema = z.object({
  label: z.string().min(1).optional(),
  value: z.string().min(1).optional(),
});

async function findOwned(tenantId: string, id: string) {
  return db.smartLinkItem.findFirst({ where: { id, tenantId } });
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await requireTenant();
  const existing = await findOwned(session.tenantId, params.id);
  if (!existing) return NextResponse.json({ error: "Link no encontrado" }, { status: 404 });

  const parsed = updateSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const item = await db.smartLinkItem.update({ where: { id: params.id }, data: parsed.data });
  return NextResponse.json({ item });
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await requireTenant();
  const existing = await findOwned(session.tenantId, params.id);
  if (!existing) return NextResponse.json({ error: "Link no encontrado" }, { status: 404 });

  await db.smartLinkItem.delete({ where: { id: params.id } });
  return NextResponse.json({ ok: true });
}
