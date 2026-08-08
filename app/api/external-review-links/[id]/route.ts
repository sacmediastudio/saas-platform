import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireTenant } from "@/lib/auth";

const PLATFORMS = ["GOOGLE", "TRIPADVISOR", "YELP", "FACEBOOK", "CUSTOM"] as const;

const updateSchema = z.object({
  platform: z.enum(PLATFORMS).optional(),
  label: z.string().min(1).optional(),
  url: z.string().url().optional(),
  enabled: z.boolean().optional(),
});

async function findOwnedLink(tenantId: string, id: string) {
  return db.externalReviewLink.findFirst({ where: { id, tenantId } });
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await requireTenant();
  const existing = await findOwnedLink(session.tenantId, params.id);
  if (!existing) {
    return NextResponse.json({ error: "Link no encontrado" }, { status: 404 });
  }

  const parsed = updateSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Datos inválidos" }, { status: 400 });
  }

  const link = await db.externalReviewLink.update({ where: { id: params.id }, data: parsed.data });
  return NextResponse.json({ link });
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await requireTenant();
  const existing = await findOwnedLink(session.tenantId, params.id);
  if (!existing) {
    return NextResponse.json({ error: "Link no encontrado" }, { status: 404 });
  }

  await db.externalReviewLink.delete({ where: { id: params.id } });
  return NextResponse.json({ ok: true });
}
