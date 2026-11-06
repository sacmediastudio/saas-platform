import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { rateLimit, getClientIp } from "@/lib/rate-limit";
import {
  hashDeviceId,
  verifyReviewPresence,
  WAITER_REVIEW_COOLDOWN_HOURS,
} from "@/lib/waiter-reviews";

const schema = z.object({
  slug: z.string().min(1).max(100),
  deviceId: z.string().min(8).max(100),
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  accuracy: z.number().min(0).max(100_000),
});

// POST /api/public/waiter-reviews/verify — el cliente toca "Calificar",
// el navegador manda sus coordenadas y acá se confirma que el local está
// abierto y que está cerca. Solo si pasa se devuelve la lista de
// meseros (con cuáles ya calificó este dispositivo).
export async function POST(req: NextRequest) {
  const { allowed, retryAfterSeconds } = rateLimit(`waiter-verify:${getClientIp(req)}`, 60, 60 * 60_000);
  if (!allowed) {
    return NextResponse.json(
      { ok: false, reason: "rate_limited" },
      { status: 429, headers: { "Retry-After": String(retryAfterSeconds) } }
    );
  }

  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ ok: false, reason: "no_location" }, { status: 400 });
  const { slug, deviceId, lat, lng, accuracy } = parsed.data;

  const presence = await verifyReviewPresence(slug, { lat, lng, accuracy });
  if (!presence.ok) return NextResponse.json({ ok: false, reason: presence.reason });

  const waiters = await db.serviceWaiter.findMany({
    where: { tenantId: presence.tenantId, isActive: true },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    select: { id: true, name: true, photoUrl: true },
  });

  const deviceHash = hashDeviceId(presence.tenantId, deviceId);
  const since = new Date(Date.now() - WAITER_REVIEW_COOLDOWN_HOURS * 3_600_000);
  const recent = await db.serviceReview.findMany({
    where: { deviceHash, waiterId: { in: waiters.map((w) => w.id) }, createdAt: { gte: since } },
    select: { waiterId: true },
  });
  const rated = new Set(recent.map((r) => r.waiterId));

  return NextResponse.json({
    ok: true,
    waiters: waiters.map((w) => ({ ...w, alreadyRated: rated.has(w.id) })),
  });
}
