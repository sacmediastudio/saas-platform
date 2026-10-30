import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { livePopupWhere } from "@/lib/app-popup";

// Misma razón que /api/public/eats/promotions: la base solo es alcanzable
// en tiempo de ejecución, no durante `next build`.
export const dynamic = "force-dynamic";

// GET /api/public/eats/popup
//
// Endpoint público con el pop-up publicitario vigente de la app de Zertoo
// Eats, o { popup: null }. Lo activa solo el admin (ver /admin/popups).
// Si hay más de uno vigente gana el más reciente. `id` sirve a la app para
// no repetirlo dentro de una misma sesión.
export async function GET() {
  const popup = await db.appPopup.findFirst({
    where: livePopupWhere(),
    orderBy: { createdAt: "desc" },
  });
  if (!popup) return NextResponse.json({ popup: null });

  // Si apunta a un negocio, solo se ofrece cuando ese negocio sigue en el directorio.
  let tenantSlug = popup.tenantSlug;
  if (tenantSlug) {
    const tenant = await db.tenant.findFirst({ where: { slug: tenantSlug, nowEnabled: true }, select: { id: true } });
    if (!tenant) tenantSlug = null;
  }

  return NextResponse.json({
    popup: { id: popup.id, imageUrl: popup.imageUrl, tenantSlug, linkUrl: popup.linkUrl },
  });
}
