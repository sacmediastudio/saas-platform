import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/auth";
import { withAuthErrors } from "@/lib/api-route";
import { deleteObject, keyFromPublicUrl } from "@/lib/s3";

export function DELETE(_req: Request, { params }: { params: { id: string } }) {
  return withAuthErrors(async () => {
    const session = await requirePermission("PROMOTIONS");
    const reel = await db.reel.findFirst({ where: { id: params.id, tenantId: session.tenantId } });
    if (!reel) return NextResponse.json({ error: "No encontrado" }, { status: 404 });
    await db.reel.delete({ where: { id: reel.id } });
    // Limpieza del storage (si falla, no importa: el reel ya no existe).
    const prefix = `${session.tenantId}/`;
    const keys = [keyFromPublicUrl(reel.videoUrl, prefix), keyFromPublicUrl(reel.posterUrl, prefix)].filter((k): k is string => !!k);
    await Promise.all(keys.map(deleteObject));
    return NextResponse.json({ ok: true });
  });
}
