import crypto from "crypto";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { generateVerificationCode, sendEatsAccountCodeEmail } from "@/lib/email";

// Cuenta de Zertoo Eats con contraseña (app build 9+). Vive en la misma
// tabla que la verificación por código de siempre (LoyaltyAccountVerification)
// para que las tarjetas de sellos, el accessToken y el borrado de cuenta
// sigan funcionando igual — solo se le suman nombre y contraseña.

export const CODE_TTL_MS = 15 * 60_000;
export const CODE_COOLDOWN_MS = 30_000;

export const emailSchema = z.string().email().max(200);
export const passwordSchema = z.string().min(8, "La contraseña debe tener al menos 8 caracteres.").max(100);
export const languageSchema = z.enum(["es", "en"]).default("es");

export function normalizeEmail(email: string) {
  return email.toLowerCase().trim();
}

export function hashPassword(password: string) {
  return bcrypt.hash(password, 10);
}

export function newAccessToken() {
  return crypto.randomBytes(32).toString("hex");
}

export function errorResponse(error: string, status: number, extra?: Record<string, unknown>) {
  return NextResponse.json({ error, ...extra }, { status });
}

export function tooManyAttempts(retryAfterSeconds: number) {
  return NextResponse.json(
    { error: "Demasiados intentos. Espera un momento e intenta de nuevo." },
    { status: 429, headers: { "Retry-After": String(retryAfterSeconds) } }
  );
}

// Guarda un código nuevo y lo manda por correo. Devuelve los segundos
// que faltan si todavía está dentro del enfriamiento (30 s, igual que el
// resto de los códigos de 6 dígitos de la plataforma).
export async function issueCode(params: {
  email: string;
  purpose: "verify" | "reset";
  name: string | null;
  language: string;
  data?: { name?: string; pendingPasswordHash?: string };
}): Promise<{ ok: true } | { ok: false; waitSeconds: number }> {
  const existing = await db.loyaltyAccountVerification.findUnique({ where: { email: params.email } });
  if (existing?.verificationCodeSentAt && Date.now() - existing.verificationCodeSentAt.getTime() < CODE_COOLDOWN_MS) {
    return {
      ok: false,
      waitSeconds: Math.ceil((CODE_COOLDOWN_MS - (Date.now() - existing.verificationCodeSentAt.getTime())) / 1000),
    };
  }

  const code = generateVerificationCode();
  const fields = {
    verificationCode: code,
    verificationCodeExpiresAt: new Date(Date.now() + CODE_TTL_MS),
    verificationCodeSentAt: new Date(),
    ...params.data,
  };
  await db.loyaltyAccountVerification.upsert({
    where: { email: params.email },
    update: fields,
    create: { email: params.email, ...fields },
  });

  await sendEatsAccountCodeEmail(params.email, code, params.purpose, params.name, params.language).catch((err) =>
    console.error("No se pudo enviar el código de la cuenta de Zertoo Eats:", err)
  );
  return { ok: true };
}

export function codeIsValid(
  account: { verificationCode: string | null; verificationCodeExpiresAt: Date | null },
  code: string
): "ok" | "missing" | "expired" | "wrong" {
  if (!account.verificationCode || !account.verificationCodeExpiresAt) return "missing";
  if (account.verificationCodeExpiresAt < new Date()) return "expired";
  const a = Buffer.from(account.verificationCode);
  const b = Buffer.from(code);
  return a.length === b.length && crypto.timingSafeEqual(a, b) ? "ok" : "wrong";
}

export const CODE_ERRORS = {
  missing: "No hay un código pendiente. Pide uno nuevo.",
  expired: "Ese código expiró. Pide uno nuevo.",
  wrong: "El código no es correcto.",
} as const;
