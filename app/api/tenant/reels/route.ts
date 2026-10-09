import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/auth";
import { withAuthErrors } from "@/lib/api-route";
import { deleteObject, getObjectRange, headObject, keyFromPublicUrl } from "@/lib/s3";
import {
  REEL_ALLOWED_TYPES,
  REEL_CAPTION_MAX,
  REEL_DURATION_TOLERANCE_SEC,
  REEL_MAX_DURATION_SEC,
  REEL_MAX_PER_TENANT,
  REEL_MAX_SIZE_BYTES,
  readMp4DurationSeconds,
} from "@/lib/reels";

const createSchema = z.object({
  videoUrl: z.string().url(),
  posterUrl: z.string().url(),
  durationSec: z.number().positive().max(120),
  width: z.number().int().positive().max(10000),
  height: z.number().int().positive().max(10000),
  caption: z.string().trim().max(REEL_CAPTION_MAX).optional(),
});

export function GET() {
  return withAuthErrors(async () => {
    const session = await requirePermission("PROMOTIONS");
    const reels = await db.reel.findMany({ where: { tenantId: session.tenantId }, orderBy: { createdAt: "desc" } });
    return NextResponse.json({ reels });
  });
}

// POST /api/tenant/reels — registra un reel DESPUÉS de que el navegador
// subió el video y la portada. Las reglas (máx. 3, 15 s, 50 MB, MP4/MOV)
// se comprueban acá contra el archivo real, no solo contra lo que dice
// el navegador; si algo no cumple, se borran los archivos subidos.
export function POST(req: NextRequest) {
  return withAuthErrors(async () => {
    const session = await requirePermission("PROMOTIONS");
    const parsed = createSchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: "Datos inválidos" }, { status: 400 });
    const data = parsed.data;

    const prefix = `${session.tenantId}/`;
    const videoKey = keyFromPublicUrl(data.videoUrl, `${prefix}reels/`);
    const posterKey = keyFromPublicUrl(data.posterUrl, prefix);
    if (!videoKey || !posterKey) return NextResponse.json({ error: "Archivo inválido" }, { status: 400 });

    async function reject(message: string) {
      await Promise.all([deleteObject(videoKey!), deleteObject(posterKey!)]);
      return NextResponse.json({ error: message }, { status: 400 });
    }

    const count = await db.reel.count({ where: { tenantId: session.tenantId } });
    if (count >= REEL_MAX_PER_TENANT) return reject(`Ya tienes ${REEL_MAX_PER_TENANT} reels. Borra uno para subir otro.`);

    const head = await headObject(videoKey);
    if (!head) return NextResponse.json({ error: "No se encontró el video subido. Intenta de nuevo." }, { status: 400 });
    if (head.size > REEL_MAX_SIZE_BYTES) return reject("El video pesa más de 50 MB.");
    if (!head.contentType || !(REEL_ALLOWED_TYPES as readonly string[]).includes(head.contentType)) {
      return reject("Formato de video no permitido (solo MP4 o MOV).");
    }

    // Duración real leyendo la cabecera del MP4/MOV (al inicio o al final
    // del archivo). Si no se puede leer, se confía en lo que midió el
    // navegador, que ya la validó antes de subir.
    const edge = 512 * 1024;
    const [startBuf, endBuf] = await Promise.all([
      getObjectRange(videoKey, `bytes=0-${edge - 1}`),
      head.size > edge ? getObjectRange(videoKey, `bytes=${Math.max(0, head.size - edge)}-${head.size - 1}`) : Promise.resolve(null),
    ]);
    const realDuration =
      (startBuf && readMp4DurationSeconds(startBuf)) || (endBuf && readMp4DurationSeconds(endBuf)) || null;
    const duration = realDuration ?? data.durationSec;
    if (duration > REEL_MAX_DURATION_SEC + REEL_DURATION_TOLERANCE_SEC) {
      return reject(`El video dura más de ${REEL_MAX_DURATION_SEC} segundos.`);
    }

    const reel = await db.reel.create({
      data: {
        tenantId: session.tenantId,
        videoUrl: data.videoUrl,
        posterUrl: data.posterUrl,
        durationSec: duration,
        width: data.width,
        height: data.height,
        sizeBytes: head.size,
        mimeType: head.contentType,
        caption: data.caption || null,
      },
    });
    return NextResponse.json({ reel }, { status: 201 });
  });
}
