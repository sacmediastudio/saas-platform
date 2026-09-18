import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { eatsCategoryLabel } from "@/lib/eats-categories";

// GET /api/public/eats/[slug]
//
// Detalle completo de un negocio para el directorio de Zertoo Eats —
// misma lógica que app/[slug]/page.tsx del proyecto zertoo-now. Un
// negocio con nowEnabled=false (o que no existe) devuelve 404 —
// mismo criterio que notFound() en la versión del sitio web, para
// que un negocio que el propio dueño desactivó del directorio no
// quede igual accesible por este otro camino.
export async function GET(_req: NextRequest, { params }: { params: { slug: string } }) {
  const tenant = await db.tenant.findUnique({
    where: { slug: params.slug },
    include: { reviews: { where: { status: "PUBLISHED" } } },
  });

  if (!tenant || !tenant.nowEnabled) {
    return NextResponse.json({ error: "No encontrado" }, { status: 404 });
  }

  const avgRating =
    tenant.reviews.length > 0
      ? tenant.reviews.reduce((sum, r) => sum + r.rating, 0) / tenant.reviews.length
      : null;

  return NextResponse.json({
    slug: tenant.slug,
    name: tenant.name,
    logoUrl: tenant.logoUrl,
    heroImageUrl: tenant.heroImageUrl,
    nowCategory: tenant.nowCategory,
    categoryLabelEs: eatsCategoryLabel(tenant.nowCategory, "es"),
    categoryLabelEn: eatsCategoryLabel(tenant.nowCategory, "en"),
    address: tenant.address,
    contactPhone: tenant.contactPhone,
    latitude: tenant.latitude,
    longitude: tenant.longitude,
    googleMapsUrl: tenant.googleMapsUrl,
    avgRating,
    reviewCount: tenant.reviews.length,
    // Construido acá, no guardado — mismo criterio que
    // business-detail.tsx del sitio web (siempre zertoo.app/menu/slug,
    // nunca un campo aparte que se pueda desincronizar del slug real).
    menuUrl: `https://zertoo.app/menu/${tenant.slug}`,
  });
}
