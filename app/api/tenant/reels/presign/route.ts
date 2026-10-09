import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/auth";
import { withAuthErrors } from "@/lib/api-route";
import { createPresignedReelUpload, isS3Configured } from "@/lib/s3";
import { REEL_ALLOWED_TYPES, REEL_MAX_PER_TENANT, REEL_MAX_SIZE_BYTES } from "@/lib/reels";

const schema = z.object({
  fileName: z.string().min(1).max(200),
  fileType: z.enum(REEL_ALLOWED_TYPES),
  fileSize: z.number().int().positive().max(REEL_MAX_SIZE_BYTES),
});

// POST /api/tenant/reels/presign — pide una URL firmada para subir el
// VIDEO del reel directo a S3/R2 (la portada sube por /api/uploads/presign
// como cualquier foto). El tamaño y el tipo se vuelven a comprobar contra
// el objeto real al crear el reel (POST /api/tenant/reels).
export function POST(req: NextRequest) {
  return withAuthErrors(async () => {
    const session = await requirePermission("PROMOTIONS");
    if (!isS3Configured()) {
      return NextResponse.json({ error: "El almacenamiento todavía no está configurado en esta plataforma." }, { status: 503 });
    }
    const parsed = schema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json({ error: "Formato no permitido (MP4 o MOV, hasta 50 MB)." }, { status: 400 });
    }
    const count = await db.reel.count({ where: { tenantId: session.tenantId } });
    if (count >= REEL_MAX_PER_TENANT) {
      return NextResponse.json({ error: `Ya tienes ${REEL_MAX_PER_TENANT} reels. Borra uno para subir otro.` }, { status: 400 });
    }
    const { uploadUrl, publicUrl } = await createPresignedReelUpload({
      tenantId: session.tenantId,
      fileName: parsed.data.fileName,
      fileType: parsed.data.fileType,
    });
    return NextResponse.json({ uploadUrl, publicUrl });
  });
}
