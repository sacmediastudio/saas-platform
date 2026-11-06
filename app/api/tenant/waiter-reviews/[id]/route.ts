import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/auth";
import { withAuthErrors } from "@/lib/api-route";

// Moderación: el negocio puede borrar una reseña sospechosa o abusiva.
export function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  return withAuthErrors(async () => {
    const session = await requirePermission("REVIEWS");
    const existing = await db.serviceReview.findFirst({ where: { id: params.id, tenantId: session.tenantId } });
    if (!existing) return NextResponse.json({ error: "No encontrada" }, { status: 404 });
    await db.serviceReview.delete({ where: { id: params.id } });
    return NextResponse.json({ ok: true });
  });
}
