import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireTenant } from "@/lib/auth";

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await requireTenant();
  const existing = await db.availabilityBlock.findFirst({
    where: { id: params.id, tenantId: session.tenantId },
  });
  if (!existing) {
    return NextResponse.json({ error: "Bloqueo no encontrado" }, { status: 404 });
  }
  await db.availabilityBlock.delete({ where: { id: params.id } });
  return NextResponse.json({ ok: true });
}
