import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireTenant } from "@/lib/auth";
import { createPresignedUpload, isS3Configured } from "@/lib/s3";

const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];

const schema = z.object({
  fileName: z.string().min(1),
  fileType: z.enum(ALLOWED_TYPES as [string, ...string[]]),
});

// POST /api/uploads/presign — el navegador pide permiso para subir un
// archivo, y le devolvemos una URL firmada donde puede hacer PUT
// directo (sin que el archivo pase por nuestro servidor), más la URL
// pública final donde va a quedar servida la imagen.
export async function POST(req: NextRequest) {
  const session = await requireTenant();

  if (!isS3Configured()) {
    return NextResponse.json(
      { error: "El almacenamiento de imágenes todavía no está configurado en esta plataforma." },
      { status: 503 }
    );
  }

  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Tipo de archivo no permitido" }, { status: 400 });
  }

  const { uploadUrl, publicUrl } = await createPresignedUpload({
    tenantId: session.tenantId,
    fileName: parsed.data.fileName,
    fileType: parsed.data.fileType,
  });

  return NextResponse.json({ uploadUrl, publicUrl });
}
