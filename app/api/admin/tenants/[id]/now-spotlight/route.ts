import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/admin-auth";

// PATCH /api/admin/tenants/[id]/now-spotlight — mismo criterio que
// now-featured: el negocio no puede activarse esto solo, es un nivel
// de suscripción más caro que cura el admin de Zertoo a mano.
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  await requireAdmin();
  const { nowSpotlight } = await req.json();

  const tenant = await db.tenant.findUnique({ where: { id: params.id } });
  if (!tenant) return NextResponse.json({ error: "No encontrado" }, { status: 404 });

  const updated = await db.tenant.update({
    where: { id: params.id },
    data: { nowSpotlight: Boolean(nowSpotlight) },
  });

  return NextResponse.json({ tenant: updated });
}
