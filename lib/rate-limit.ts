/**
 * Límite de frecuencia simple, en memoria — sirve mientras la
 * plataforma corre en una sola instancia (que es el caso hoy en
 * Railway). Si algún día se escala a varias instancias en paralelo,
 * esto habría que moverlo a un almacén compartido (ej. Redis), porque
 * cada instancia tendría su propio conteo por separado.
 */

interface Bucket {
  count: number;
  resetAt: number;
}

const buckets = new Map<string, Bucket>();

// Barrido liviano cada cierta cantidad de llamadas, para que el Map no
// crezca sin límite con IPs que ya no vuelven a pedir nada.
let callsSinceSweep = 0;
function sweepExpired() {
  callsSinceSweep++;
  if (callsSinceSweep < 200) return;
  callsSinceSweep = 0;
  const now = Date.now();
  for (const [key, bucket] of buckets) {
    if (bucket.resetAt < now) buckets.delete(key);
  }
}

/**
 * @param key identificador único de "quién + qué endpoint" (ej. `menu-leads:203.0.113.5`)
 * @param limit cuántas solicitudes se permiten dentro de la ventana
 * @param windowMs duración de la ventana, en milisegundos
 */
export function rateLimit(key: string, limit: number, windowMs: number): { allowed: boolean; retryAfterSeconds: number } {
  sweepExpired();
  const now = Date.now();
  const bucket = buckets.get(key);

  if (!bucket || bucket.resetAt < now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, retryAfterSeconds: 0 };
  }

  if (bucket.count >= limit) {
    return { allowed: false, retryAfterSeconds: Math.ceil((bucket.resetAt - now) / 1000) };
  }

  bucket.count++;
  return { allowed: true, retryAfterSeconds: 0 };
}

/** Saca la IP real del visitante — Railway (y la mayoría de hostings) la mandan en este header. */
export function getClientIp(req: Request): string {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  return req.headers.get("x-real-ip") ?? "unknown";
}
