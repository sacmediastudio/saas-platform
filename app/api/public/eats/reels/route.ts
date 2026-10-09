import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

// GET /api/public/eats/reels?deviceId=X — los reels del carrusel del
// inicio de Zertoo Eats (app y web): de todos los negocios con Eats
// activo, del más nuevo al más antiguo. `deviceId` (opcional) solo sirve
// para marcar cuáles ya tienen "me gusta" de ese dispositivo.
export async function GET(req: NextRequest) {
  const deviceId = new URL(req.url).searchParams.get("deviceId")?.slice(0, 100) || null;

  const reels = await db.reel.findMany({
    where: { tenant: { nowEnabled: true, suspended: false } },
    orderBy: { createdAt: "desc" },
    take: 30,
    include: {
      tenant: {
        select: {
          slug: true,
          name: true,
          logoUrl: true,
          heroTagline: true,
          address: true,
          latitude: true,
          longitude: true,
          googleMapsUrl: true,
        },
      },
      likes: deviceId ? { where: { deviceId }, select: { id: true } } : false,
    },
  });

  return NextResponse.json({
    reels: reels.map((r) => ({
      id: r.id,
      videoUrl: r.videoUrl,
      posterUrl: r.posterUrl,
      durationSec: r.durationSec,
      width: r.width,
      height: r.height,
      caption: r.caption,
      likes: r.likesCount,
      liked: Array.isArray(r.likes) ? r.likes.length > 0 : false,
      business: {
        slug: r.tenant.slug,
        name: r.tenant.name,
        logoUrl: r.tenant.logoUrl,
        tagline: r.tenant.heroTagline,
        address: r.tenant.address,
        latitude: r.tenant.latitude,
        longitude: r.tenant.longitude,
        googleMapsUrl: r.tenant.googleMapsUrl,
        menuUrl: `https://zertoo.app/menu/${r.tenant.slug}`,
      },
    })),
  });
}
