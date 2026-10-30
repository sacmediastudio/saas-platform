import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/admin-auth";
import { withAuthErrors } from "@/lib/api-route";
import { createPresignedUpload, isS3Configured } from "@/lib/s3";

const schema = z.object({
  fileName: z.string().min(1).max(200),
  fileType: z.enum(["image/jpeg", "image/png", "image/webp"]),
});

// POST /api/admin/popups/presign — URL firmada para subir la imagen de un
// pop-up. Las imágenes del admin viven bajo "zertoo-ads/" (no hay un
// negocio dueño de esta imagen).
export function POST(req: NextRequest) {
  return withAuthErrors(async () => {
    await requireAdmin();
    if (!isS3Configured()) {
      return NextResponse.json({ error: "El almacenamiento todavía no está configurado." }, { status: 503 });
    }
    const parsed = schema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: "Formato no permitido (JPG, PNG o WebP)." }, { status: 400 });
    const { uploadUrl, publicUrl } = await createPresignedUpload({
      tenantId: "zertoo-ads",
      fileName: parsed.data.fileName,
      fileType: parsed.data.fileType,
    });
    return NextResponse.json({ uploadUrl, publicUrl });
  });
}
