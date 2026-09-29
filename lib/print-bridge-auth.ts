import crypto from "crypto";
import { db } from "./db";

// Autenticación del Print Bridge (ítem 5) — un proceso sin usuario
// logueado corriendo en la red del restaurante, por eso NO usa la
// cookie de sesión como todo lo demás en este proyecto. Usa una API
// key propia de larga duración en el header Authorization: Bearer.
const KEY_PREFIX = "pb_live_";

export function generatePrintBridgeApiKey(): string {
  return KEY_PREFIX + crypto.randomBytes(24).toString("base64url");
}

export function hashPrintBridgeApiKey(rawKey: string): string {
  return crypto.createHash("sha256").update(rawKey).digest("hex");
}

/**
 * Igual que requireTenant()/requirePermission() en lib/auth.ts pero
 * para las rutas que llama el Print Bridge — tira una Response cruda
 * en vez de la sesión de un usuario, y devuelve el tenantId directo.
 */
export async function requirePrintBridgeAuth(req: Request): Promise<string> {
  const header = req.headers.get("authorization") ?? "";
  const match = header.match(/^Bearer\s+(.+)$/i);
  if (!match || !match[1].startsWith(KEY_PREFIX)) {
    throw new Response(JSON.stringify({ error: "Falta o es inválido el header Authorization: Bearer <api key>" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  const tenant = await db.tenant.findUnique({
    where: { printBridgeApiKeyHash: hashPrintBridgeApiKey(match[1].trim()) },
    select: { id: true },
  });
  if (!tenant) {
    throw new Response(JSON.stringify({ error: "API key inválida o revocada" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }
  return tenant.id;
}
