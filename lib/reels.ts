// Reglas de los reels de Zertoo Eats (videos cortos de cada negocio).
// Las mismas cifras se muestran en el dashboard — si se cambian acá,
// se reflejan en las dos puntas porque el dashboard las importa.

export const REEL_MAX_PER_TENANT = 3;
export const REEL_MAX_DURATION_SEC = 15;
// Pequeña tolerancia: algunos teléfonos graban "15.02 s" en un clip de 15.
export const REEL_DURATION_TOLERANCE_SEC = 0.5;
export const REEL_MAX_SIZE_BYTES = 50 * 1024 * 1024; // 50 MB
export const REEL_ALLOWED_TYPES = ["video/mp4", "video/quicktime"] as const;
export const REEL_ALLOWED_EXTENSIONS = [".mp4", ".mov"] as const;
export const REEL_CAPTION_MAX = 80;

/**
 * Duración (segundos) leyendo la caja `mvhd` de un MP4/MOV (ISO BMFF).
 * Devuelve null si no se encuentra en el fragmento. `moov` puede estar al
 * inicio o al final del archivo, por eso se prueba con los dos extremos.
 */
export function readMp4DurationSeconds(buf: Buffer): number | null {
  const idx = buf.indexOf("mvhd");
  if (idx < 0 || idx + 28 > buf.length) return null;
  const version = buf[idx + 4];
  try {
    if (version === 1) {
      const timescale = buf.readUInt32BE(idx + 24);
      const duration = Number(buf.readBigUInt64BE(idx + 28));
      return timescale > 0 ? duration / timescale : null;
    }
    const timescale = buf.readUInt32BE(idx + 16);
    const duration = buf.readUInt32BE(idx + 20);
    return timescale > 0 ? duration / timescale : null;
  } catch {
    return null;
  }
}
