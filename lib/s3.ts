import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

// Funciona igual para AWS S3 que para Cloudflare R2 (y cualquier otro
// storage compatible con la API de S3) — R2 solo necesita que le pasemos
// su propio endpoint. Sin S3_ENDPOINT configurado, el SDK asume AWS S3.
const REGION = process.env.S3_REGION || "auto";
const BUCKET = process.env.S3_BUCKET || "";
const ENDPOINT = process.env.S3_ENDPOINT || undefined; // solo para R2 u otros compatibles
const ACCESS_KEY_ID = process.env.S3_ACCESS_KEY_ID || "";
const SECRET_ACCESS_KEY = process.env.S3_SECRET_ACCESS_KEY || "";
// La URL pública desde donde se van a servir las imágenes. Para R2 con
// un dominio propio conectado, o para un bucket de S3 detrás de
// CloudFront, esta es esa URL. Sin configurar, se intenta armar una por
// defecto (funciona para S3 estándar, no para R2 — R2 SIEMPRE necesita
// esta variable configurada explícitamente).
const PUBLIC_URL_BASE = process.env.S3_PUBLIC_URL_BASE || "";

export function isS3Configured(): boolean {
  return Boolean(BUCKET && ACCESS_KEY_ID && SECRET_ACCESS_KEY);
}

let cachedClient: S3Client | null = null;
function getClient(): S3Client {
  if (cachedClient) return cachedClient;
  cachedClient = new S3Client({
    region: REGION,
    endpoint: ENDPOINT,
    // R2 requiere "path-style" en vez del "virtual-hosted-style" que usa
    // S3 por defecto — forceStyle solo aplica cuando hay endpoint custom.
    forcePathStyle: Boolean(ENDPOINT),
    credentials: { accessKeyId: ACCESS_KEY_ID, secretAccessKey: SECRET_ACCESS_KEY },
  });
  return cachedClient;
}

function publicUrlFor(key: string): string {
  if (PUBLIC_URL_BASE) return `${PUBLIC_URL_BASE.replace(/\/$/, "")}/${key}`;
  // Fallback razonable solo para AWS S3 estándar (no funciona para R2).
  return `https://${BUCKET}.s3.${REGION}.amazonaws.com/${key}`;
}

/**
 * Genera una URL firmada de subida (PUT) válida por poco tiempo, para
 * que el navegador suba el archivo directo a S3/R2 sin que pase por
 * nuestro servidor — más rápido y no consume ancho de banda de Railway.
 */
export async function createPresignedUpload(params: {
  tenantId: string;
  fileName: string;
  fileType: string;
}): Promise<{ uploadUrl: string; publicUrl: string; key: string }> {
  const ext = params.fileName.split(".").pop()?.toLowerCase().replace(/[^a-z0-9]/g, "") || "jpg";
  const key = `${params.tenantId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;

  const command = new PutObjectCommand({
    Bucket: BUCKET,
    Key: key,
    ContentType: params.fileType,
  });

  const uploadUrl = await getSignedUrl(getClient(), command, { expiresIn: 300 }); // 5 min

  return { uploadUrl, publicUrl: publicUrlFor(key), key };
}
