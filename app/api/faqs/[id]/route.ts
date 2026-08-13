import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireTenant } from "@/lib/auth";

const updateSchema = z.object({
  question: z.string().min(1).max(200).optional(),
  answer: z.string().min(1).max(1000).optional(),
  sortOrder: z.number().int().optional(),
});

async function findOwned(tenantId: string, id: string) {
  return db.faqItem.findFirst({ where: { id, tenantId } });
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await requireTenant();
  const existing = await findOwned(session.tenantId, params.id);
  if (!existing) return NextResponse.json({ error: "No encontrada" }, { status: 404 });

  const parsed = updateSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Datos inválidos" }, { status: 400 });
  }

  const faq = await db.faqItem.update({ where: { id: params.id }, data: parsed.data });
  return NextResponse.json({ faq });
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await requireTenant();
  const existing = await findOwned(session.tenantId, params.id);
  if (!existing) return NextResponse.json({ error: "No encontrada" }, { status: 404 });

  await db.faqItem.delete({ where: { id: params.id } });
  return NextResponse.json({ ok: true });
}
