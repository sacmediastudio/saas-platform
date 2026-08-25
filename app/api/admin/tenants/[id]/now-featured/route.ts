import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/admin-auth";

// PATCH /api/admin/tenants/[id]/now-featured — el negocio no puede
// activarse esto solo (a diferencia de nowEnabled, que sí decide él
// mismo desde su dashboard) — "Destacado" lo cura el admin de Zertoo
// a mano, tiene un valor especial.
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  await requireAdmin();
  const { nowFeatured } = await req.json();

  const tenant = await db.tenant.findUnique({ where: { id: params.id } });
  if (!tenant) return NextResponse.json({ error: "No encontrado" }, { status: 404 });

  const updated = await db.tenant.update({
    where: { id: params.id },
    data: { nowFeatured: Boolean(nowFeatured) },
  });

  return NextResponse.json({ tenant: updated });
}
