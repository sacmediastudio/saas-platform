import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { z } from "zod";
import { db } from "@/lib/db";
import { rateLimit, getClientIp } from "@/lib/rate-limit";
import {
  hashDeviceId,
  verifyReviewPresence,
  WAITER_NOTE_MAX,
  WAITER_REVIEW_COOLDOWN_HOURS,
} from "@/lib/waiter-reviews";

const schema = z.object({
  slug: z.string().min(1).max(100),
  deviceId: z.string().min(8).max(100),
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  accuracy: z.number().min(0).max(100_000),
  note: z.string().max(WAITER_NOTE_MAX).optional(),
  ratings: z
    .array(
      z.object({
        waiterId: z.string().min(1).max(60),
        // 1.0 a 5.0 en pasos de 0.5
        rating: z
          .number()
          .min(1)
          .max(5)
          .refine((n) => Number.isInteger(n * 2), "El puntaje va en pasos de 0.5"),
      })
    )
    .min(1)
    .max(30),
});

// POST /api/public/waiter-reviews/submit — guarda las calificaciones.
// Repite TODA la verificación (horario, distancia, límite por
// dispositivo): lo que mandó /verify antes no se da por válido.
export async function POST(req: NextRequest) {
  const { allowed, retryAfterSeconds } = rateLimit(`waiter-submit:${getClientIp(req)}`, 30, 60 * 60_000);
  if (!allowed) {
    return NextResponse.json(
      { ok: false, reason: "rate_limited" },
      { status: 429, headers: { "Retry-After": String(retryAfterSeconds) } }
    );
  }

  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ ok: false, reason: "invalid" }, { status: 400 });
  const { slug, deviceId, lat, lng, accuracy, ratings } = parsed.data;
  const note = parsed.data.note?.trim() || null;

  const presence = await verifyReviewPresence(slug, { lat, lng, accuracy });
  if (!presence.ok) return NextResponse.json({ ok: false, reason: presence.reason });

  // Un mismo mesero no puede venir dos veces en el mismo envío.
  const unique = Array.from(new Map(ratings.map((r) => [r.waiterId, r])).values());

  const validWaiters = await db.serviceWaiter.findMany({
    where: { tenantId: presence.tenantId, isActive: true, id: { in: unique.map((r) => r.waiterId) } },
    select: { id: true },
  });
  const validIds = new Set(validWaiters.map((w) => w.id));
  const toRate = unique.filter((r) => validIds.has(r.waiterId));
  if (toRate.length === 0) return NextResponse.json({ ok: false, reason: "invalid" }, { status: 400 });

  const deviceHash = hashDeviceId(presence.tenantId, deviceId);
  const since = new Date(Date.now() - WAITER_REVIEW_COOLDOWN_HOURS * 3_600_000);
  const recent = await db.serviceReview.findMany({
    where: { deviceHash, waiterId: { in: toRate.map((r) => r.waiterId) }, createdAt: { gte: since } },
    select: { waiterId: true },
  });
  const blocked = new Set(recent.map((r) => r.waiterId));
  const fresh = toRate.filter((r) => !blocked.has(r.waiterId));
  if (fresh.length === 0) return NextResponse.json({ ok: false, reason: "already_rated" }, { status: 429 });

  const submissionId = randomUUID();
  await db.serviceReview.createMany({
    data: fresh.map((r) => ({
      tenantId: presence.tenantId,
      waiterId: r.waiterId,
      rating: r.rating,
      note,
      submissionId,
      deviceHash,
      distanceM: presence.distanceM,
    })),
  });

  return NextResponse.json({ ok: true, saved: fresh.length });
}
