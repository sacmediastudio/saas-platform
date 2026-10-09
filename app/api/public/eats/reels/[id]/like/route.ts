import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { rateLimit, getClientIp } from "@/lib/rate-limit";

const schema = z.object({ deviceId: z.string().min(8).max(100) });

// POST /api/public/eats/reels/[id]/like — alterna el "me gusta" de ese
// dispositivo (uno por dispositivo, sin cuentas) y devuelve el estado
// final y el total.
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const { allowed } = rateLimit(`reel-like:${getClientIp(req)}`, 120, 10 * 60_000);
  if (!allowed) return NextResponse.json({ error: "Demasiados intentos." }, { status: 429 });

  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Datos inválidos" }, { status: 400 });
  const { deviceId } = parsed.data;

  const reel = await db.reel.findUnique({ where: { id: params.id }, select: { id: true } });
  if (!reel) return NextResponse.json({ error: "No encontrado" }, { status: 404 });

  const result = await db.$transaction(async (tx) => {
    const existing = await tx.reelLike.findUnique({ where: { reelId_deviceId: { reelId: reel.id, deviceId } } });
    if (existing) {
      await tx.reelLike.delete({ where: { id: existing.id } });
      const updated = await tx.reel.update({ where: { id: reel.id }, data: { likesCount: { decrement: 1 } }, select: { likesCount: true } });
      return { liked: false, likes: Math.max(0, updated.likesCount) };
    }
    await tx.reelLike.create({ data: { reelId: reel.id, deviceId } });
    const updated = await tx.reel.update({ where: { id: reel.id }, data: { likesCount: { increment: 1 } }, select: { likesCount: true } });
    return { liked: true, likes: updated.likesCount };
  });

  return NextResponse.json(result);
}
