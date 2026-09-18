import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

// GET /api/public/eats/promotions
//
// Endpoint público (sin autenticación) con las promociones activas de
// los negocios de Zertoo Eats — pensado para el botón "Promos" y las
// notificaciones push de la app móvil. Mismo criterio de nowEnabled que
// /api/public/eats/listings: un negocio que el propio dueño sacó del
// directorio no debe seguir mostrando promos por este otro camino.
//
// Una promoción con startsAt/endsAt en el futuro o el pasado no se
// devuelve — "active" en la base es solo el interruptor manual del
// negocio, la vigencia real también depende de las fechas.
export async function GET(_req: NextRequest) {
  const now = new Date();

  const promotions = await db.promotion.findMany({
    where: {
      active: true,
      OR: [{ startsAt: null }, { startsAt: { lte: now } }],
      AND: [{ OR: [{ endsAt: null }, { endsAt: { gte: now } }] }],
      tenant: { nowEnabled: true },
    },
    include: {
      tenant: { select: { name: true, slug: true, logoUrl: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({
    promotions: promotions.map((p) => ({
      id: p.id,
      title: p.title,
      description: p.description,
      imageUrl: p.imageUrl,
      startsAt: p.startsAt,
      endsAt: p.endsAt,
      tenantName: p.tenant.name,
      tenantSlug: p.tenant.slug,
      tenantLogoUrl: p.tenant.logoUrl,
    })),
  });
}
