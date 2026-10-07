import crypto from "crypto";
import { db } from "./db";

// Verificación de contacto para pedidos de DELIVERY del menú público.
// Flujo: createCode → (WhatsApp o correo) → confirmCode devuelve un
// token que el navegador recuerda → el pedido lo manda de vuelta e
// isVerified lo comprueba. Solo se guardan hashes del código y del token.

export const CODE_TTL_MS = 15 * 60_000;
export const CODE_COOLDOWN_MS = 30_000;
export const TOKEN_TTL_MS = 30 * 24 * 60 * 60_000;
export const MAX_ATTEMPTS = 5;

export function normalizeOrderPhone(phone: string): string {
  return phone.replace(/\D/g, "");
}

function sha256(value: string): string {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function safeEqual(a: string, b: string): boolean {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  return ba.length === bb.length && crypto.timingSafeEqual(ba, bb);
}

export type CreateCodeResult = { ok: true; code: string } | { ok: false; waitSeconds: number };

/** Crea (o reemplaza) el código pendiente de ese teléfono. */
export async function createCode(phone: string): Promise<CreateCodeResult> {
  const existing = await db.orderContactVerification.findUnique({ where: { phone } });
  if (existing?.codeSentAt && Date.now() - existing.codeSentAt.getTime() < CODE_COOLDOWN_MS) {
    return {
      ok: false,
      waitSeconds: Math.ceil((CODE_COOLDOWN_MS - (Date.now() - existing.codeSentAt.getTime())) / 1000),
    };
  }
  const code = String(crypto.randomInt(100000, 1000000));
  const data = {
    codeHash: sha256(`${phone}:${code}`),
    codeExpiresAt: new Date(Date.now() + CODE_TTL_MS),
    codeSentAt: new Date(),
    attempts: 0,
  };
  await db.orderContactVerification.upsert({
    where: { phone },
    update: data,
    create: { phone, ...data },
  });
  return { ok: true, code };
}

export type ConfirmResult = { ok: true; token: string } | { ok: false; error: string };

/** Valida el código y entrega el token de larga duración. */
export async function confirmCode(phone: string, code: string): Promise<ConfirmResult> {
  const row = await db.orderContactVerification.findUnique({ where: { phone } });
  if (!row || !row.codeHash || !row.codeExpiresAt) {
    return { ok: false, error: "No hay un código pendiente. Pide uno nuevo." };
  }
  if (row.codeExpiresAt < new Date()) {
    return { ok: false, error: "Ese código expiró. Pide uno nuevo." };
  }
  if (row.attempts >= MAX_ATTEMPTS) {
    return { ok: false, error: "Demasiados intentos. Pide un código nuevo." };
  }
  if (!safeEqual(row.codeHash, sha256(`${phone}:${code}`))) {
    await db.orderContactVerification.update({ where: { phone }, data: { attempts: { increment: 1 } } });
    return { ok: false, error: "El código no es correcto." };
  }
  const token = crypto.randomBytes(32).toString("hex");
  await db.orderContactVerification.update({
    where: { phone },
    data: {
      tokenHash: sha256(token),
      tokenExpiresAt: new Date(Date.now() + TOKEN_TTL_MS),
      codeHash: null,
      codeExpiresAt: null,
      attempts: 0,
    },
  });
  return { ok: true, token };
}

/** ¿Este token fue emitido para ese teléfono y sigue vigente? */
export async function isVerified(phone: string, token: string | undefined): Promise<boolean> {
  if (!token) return false;
  const row = await db.orderContactVerification.findUnique({ where: { phone } });
  if (!row?.tokenHash || !row.tokenExpiresAt || row.tokenExpiresAt < new Date()) return false;
  return safeEqual(row.tokenHash, sha256(token));
}
