import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { sendLoyaltyAccountVerificationEmail, generateVerificationCode } from "@/lib/email";
import { rateLimit, getClientIp } from "@/lib/rate-limit";

const schema = z.object({ email: z.string().email() });

const COOLDOWN_MS = 30_000; // mismo criterio que el resto de los códigos de 6 dígitos

// POST /api/public/eats/loyalty-account/request-code — primer paso para
// que la app pueda mostrar "Mis sellos": manda un código de 6 dígitos
// al correo, sin revelar todavía si ese correo tiene o no tarjetas.
export async function POST(req: NextRequest) {
  const { allowed, retryAfterSeconds } = rateLimit(`loyalty-account-request:${getClientIp(req)}`, 10, 60 * 60_000);
  if (!allowed) {
    return NextResponse.json(
      { error: "Demasiados intentos. Espera un momento e intenta de nuevo." },
      { status: 429, headers: { "Retry-After": String(retryAfterSeconds) } }
    );
  }

  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Correo inválido" }, { status: 400 });
  }
  const email = parsed.data.email.toLowerCase().trim();

  const existing = await db.loyaltyAccountVerification.findUnique({ where: { email } });
  if (existing?.verificationCodeSentAt && Date.now() - existing.verificationCodeSentAt.getTime() < COOLDOWN_MS) {
    const waitSeconds = Math.ceil(
      (COOLDOWN_MS - (Date.now() - existing.verificationCodeSentAt.getTime())) / 1000
    );
    return NextResponse.json(
      { error: `Espera ${waitSeconds} segundos antes de pedir otro código.` },
      { status: 429 }
    );
  }

  const code = generateVerificationCode();
  const expiresAt = new Date(Date.now() + 15 * 60_000);

  await db.loyaltyAccountVerification.upsert({
    where: { email },
    update: { verificationCode: code, verificationCodeExpiresAt: expiresAt, verificationCodeSentAt: new Date() },
    create: { email, verificationCode: code, verificationCodeExpiresAt: expiresAt, verificationCodeSentAt: new Date() },
  });

  await sendLoyaltyAccountVerificationEmail(email, code).catch((err) =>
    console.error("No se pudo enviar el código de verificación de sellos:", err)
  );

  return NextResponse.json({ ok: true });
}
