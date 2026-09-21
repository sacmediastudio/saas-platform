import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { rateLimit, getClientIp } from "@/lib/rate-limit";

// GET /api/public/eats/loyalty-account/cards?email=X&token=Y — la
// vista agregada de "Mis sellos": todas las tarjetas de un cliente en
// TODOS los negocios de Zertoo a la vez. Requiere el accessToken que
// entregó /confirm — sin esto, cualquiera que supiera un correo ajeno
// podría ver su actividad en toda la plataforma, no solo en un negocio
// puntual como sí permite (sin verificar) GET /api/public/loyalty.
export async function GET(req: NextRequest) {
  const { allowed, retryAfterSeconds } = rateLimit(`loyalty-account-cards:${getClientIp(req)}`, 30, 15 * 60_000);
  if (!allowed) {
    return NextResponse.json(
      { error: "Demasiados intentos. Espera un momento e intenta de nuevo." },
      { status: 429, headers: { "Retry-After": String(retryAfterSeconds) } }
    );
  }

  const { searchParams } = new URL(req.url);
  const email = searchParams.get("email")?.toLowerCase().trim();
  const token = searchParams.get("token");
  if (!email || !token) return NextResponse.json({ error: "Faltan datos" }, { status: 400 });

  const account = await db.loyaltyAccountVerification.findUnique({ where: { email } });
  if (!account || !account.verifiedAt || !account.accessToken || account.accessToken !== token) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const cards = await db.loyaltyCard.findMany({
    where: { customerEmail: email },
    orderBy: { lastVisitAt: "desc" },
    include: {
      tenant: {
        select: { name: true, slug: true, logoUrl: true, loyaltyEnabled: true, loyaltyVisitsNeeded: true, loyaltyReward: true },
      },
    },
  });

  return NextResponse.json({
    cards: cards.map((c) => ({
      cardId: c.id,
      businessName: c.tenant.name,
      slug: c.tenant.slug,
      logoUrl: c.tenant.logoUrl,
      active: c.tenant.loyaltyEnabled,
      stamps: c.stamps,
      visitsNeeded: c.tenant.loyaltyVisitsNeeded,
      reward: c.tenant.loyaltyReward,
      rewardsRedeemed: c.rewardsRedeemed,
    })),
  });
}
