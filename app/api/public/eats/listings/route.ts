import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import type { NowCategory, NowPriceRange, Prisma } from "@prisma/client";
import { eatsCategoryLabel, eatsPriceRangeLabel, haversineKm, EATS_MAX_NEAR_ME_KM } from "@/lib/eats-categories";

// Orden real de precio (no alfabético) — así el filtro y la lista de
// opciones siempre van de más barato a más caro.
const PRICE_RANGE_ORDER: NowPriceRange[] = ["BUDGET", "MODERATE", "EXPENSIVE", "LUXURY"];

const activePromotionsWhere = (now: Date) => ({
  active: true,
  OR: [{ startsAt: null }, { startsAt: { lte: now } }],
  AND: [{ OR: [{ endsAt: null }, { endsAt: { gte: now } }] }],
});

const tenantWithRatingsInclude = (now: Date) => ({
  reviews: { where: { status: "PUBLISHED" as const } },
  // Trae el "kind" (no solo si existe) para poder priorizar SPECIAL
  // sobre PROMO en el indicador de la tarjeta cuando un negocio tiene
  // los dos tipos activos a la vez.
  promotions: {
    where: activePromotionsWhere(now),
    select: { id: true, kind: true },
  },
});

type TenantWithRatings = Prisma.TenantGetPayload<{ include: ReturnType<typeof tenantWithRatingsInclude> }>;

function mapTenant(
  t: TenantWithRatings,
  opts: { nearMeActive: boolean; userLat: number | null; userLng: number | null }
) {
  const publishedReviews = t.reviews;
  const avgRating =
    publishedReviews.length > 0
      ? publishedReviews.reduce((sum, r) => sum + r.rating, 0) / publishedReviews.length
      : null;
  const distanceKm =
    opts.nearMeActive && t.latitude !== null && t.longitude !== null
      ? haversineKm(opts.userLat!, opts.userLng!, t.latitude, t.longitude)
      : null;
  const promoKind = t.promotions.some((p) => p.kind === "SPECIAL")
    ? "SPECIAL"
    : t.promotions.length > 0
      ? "PROMO"
      : null;
  return {
    id: t.id,
    slug: t.slug,
    name: t.name,
    logoUrl: t.logoUrl,
    heroImageUrl: t.heroImageUrl,
    address: t.address,
    nowCategory: t.nowCategory,
    categoryLabelEs: eatsCategoryLabel(t.nowCategory, "es"),
    categoryLabelEn: eatsCategoryLabel(t.nowCategory, "en"),
    nowPriceRange: t.nowPriceRange,
    priceRangeLabel: eatsPriceRangeLabel(t.nowPriceRange),
    avgRating,
    reviewCount: publishedReviews.length,
    distanceKm,
    nowFeatured: t.nowFeatured,
    hasPromo: t.promotions.length > 0,
    promoKind,
  };
}

// GET /api/public/eats/listings?category=SUSHI&priceRange=BUDGET&q=texto&lat=12.5&lng=-70.0
//
// Endpoint público (sin autenticación) para el directorio de Zertoo
// Eats — pensado para que la app móvil (y cualquier otro cliente,
// como el propio sitio web si algún día se migra a consumir esto en
// vez de leer la base directo) obtenga la misma lista que ya arma
// app/page.tsx del proyecto zertoo-now, sin necesitar acceso directo
// a la base de datos. La lógica de acá es una copia deliberada de la
// de ese archivo — mismo criterio de featured/resto, mismo radio de
// "cerca de mí", mismo cálculo de rating — para que ambos productos
// (web y móvil) muestren siempre lo mismo.
//
// Parámetros, todos opcionales:
// - category: uno de los valores del enum NowCategory (ej. "SUSHI")
// - priceRange: uno de los valores del enum NowPriceRange (ej. "BUDGET")
// - q: texto libre, busca por nombre del negocio (case-insensitive)
// - lat + lng: si se pasan los 2, activa el modo "cerca de mí" —
//   devuelve además un array "nearby" ordenado por distancia real,
//   limitado a los 20 km del radio configurado.
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const category = searchParams.get("category");
  const priceRange = searchParams.get("priceRange");
  const q = searchParams.get("q")?.trim().toLowerCase() || "";
  const latParam = searchParams.get("lat");
  const lngParam = searchParams.get("lng");
  const now = new Date();

  const userLat = latParam ? Number(latParam) : null;
  const userLng = lngParam ? Number(lngParam) : null;
  const nearMeActive = userLat !== null && userLng !== null && !Number.isNaN(userLat) && !Number.isNaN(userLng);
  const mapOpts = { nearMeActive, userLat, userLng };

  const allTenants = await db.tenant.findMany({
    where: {
      nowEnabled: true,
      ...(category ? { nowCategory: category as NowCategory } : {}),
      ...(priceRange ? { nowPriceRange: priceRange as NowPriceRange } : {}),
      ...(q ? { name: { contains: q, mode: "insensitive" } } : {}),
    },
    include: tenantWithRatingsInclude(now),
    orderBy: { nowFeatured: "desc" },
  });

  const withRatings = allTenants.map((t) => mapTenant(t, mapOpts));

  // Igual criterio que el sitio web: con "cerca de mí" activo, un solo
  // listado ordenado por distancia real (destacado vs. resto no tiene
  // sentido mezclado con un orden por cercanía). Los negocios sin
  // coordenadas quedan al final; los que sí tienen coordenadas pero
  // están confirmados fuera del radio, se descartan directamente.
  const nearby = nearMeActive
    ? [...withRatings]
        .filter((t) => t.distanceKm === null || t.distanceKm <= EATS_MAX_NEAR_ME_KM)
        .sort((a, b) => {
          if (a.distanceKm === null && b.distanceKm === null) return 0;
          if (a.distanceKm === null) return 1;
          if (b.distanceKm === null) return -1;
          return a.distanceKm - b.distanceKm;
        })
    : null;

  const featured = withRatings.filter((t) => t.nowFeatured);
  const rest = withRatings.filter((t) => !t.nowFeatured);

  // El carrusel de portada (suscripción premium, cura el admin desde
  // /admin/now) es SIEMPRE el mismo set de negocios, sin importar el
  // filtro de categoría/precio/búsqueda que haya puesto el usuario —
  // es una vidriera fija, no un resultado de búsqueda. Por eso es una
  // consulta aparte, no un .filter() sobre allTenants.
  const spotlightTenants = await db.tenant.findMany({
    where: { nowEnabled: true, nowSpotlight: true },
    include: tenantWithRatingsInclude(now),
    orderBy: { name: "asc" },
  });
  const spotlight = spotlightTenants.map((t) => mapTenant(t, mapOpts));

  // Categorías disponibles: solo las que de verdad tienen algún
  // negocio activo ahora mismo (sin el filtro de category/q aplicado,
  // para que la lista de categorías no se reduzca sola cuando ya hay
  // un filtro puesto — mismo comportamiento que el sitio web).
  const allActiveTenants = await db.tenant.findMany({
    where: { nowEnabled: true },
    select: { nowCategory: true, nowPriceRange: true },
  });
  const availableCategories = Array.from(
    new Set(allActiveTenants.map((t) => t.nowCategory).filter((c): c is NowCategory => Boolean(c)))
  )
    .sort((a, b) => (eatsCategoryLabel(a, "es") ?? a).localeCompare(eatsCategoryLabel(b, "es") ?? b))
    .map((value) => ({ value, labelEs: eatsCategoryLabel(value, "es"), labelEn: eatsCategoryLabel(value, "en") }));

  // Mismo criterio que availableCategories (solo lo que de verdad tiene
  // algún negocio activo ahora), pero ordenado de más barato a más caro
  // en vez de alfabético.
  const activePriceRanges = new Set(
    allActiveTenants.map((t) => t.nowPriceRange).filter((p): p is NowPriceRange => Boolean(p))
  );
  const availablePriceRanges = PRICE_RANGE_ORDER.filter((p) => activePriceRanges.has(p)).map((value) => ({
    value,
    label: eatsPriceRangeLabel(value),
  }));

  return NextResponse.json({
    spotlight,
    featured,
    rest,
    nearby,
    nearMeActive,
    availableCategories,
    availablePriceRanges,
  });
}
