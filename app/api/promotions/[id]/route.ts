import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireTenant } from "@/lib/auth";

const updateSchema = z.object({
  title: z.string().min(1).max(120).optional(),
  description: z.string().max(500).nullable().optional(),
  imageUrl: z.string().url().nullable().optional(),
  active: z.boolean().optional(),
  startsAt: z.string().datetime().nullable().optional(),
  endsAt: z.string().datetime().nullable().optional(),
});

async function findOwned(tenantId: string, id: string) {
  return db.promotion.findFirst({ where: { id, tenantId } });
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await requireTenant();
  const existing = await findOwned(session.tenantId, params.id);
  if (!existing) return NextResponse.json({ error: "No encontrada" }, { status: 404 });

  const parsed = updateSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Datos inválidos" }, { status: 400 });
  }

  const { startsAt, endsAt, ...rest } = parsed.data;
  const promotion = await db.promotion.update({
    where: { id: params.id },
    data: {
      ...rest,
      ...(startsAt !== undefined ? { startsAt: startsAt ? new Date(startsAt) : null } : {}),
      ...(endsAt !== undefined ? { endsAt: endsAt ? new Date(endsAt) : null } : {}),
    },
  });
  return NextResponse.json({ promotion });
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await requireTenant();
  const existing = await findOwned(session.tenantId, params.id);
  if (!existing) return NextResponse.json({ error: "No encontrada" }, { status: 404 });

  await db.promotion.delete({ where: { id: params.id } });
  return NextResponse.json({ ok: true });
}
