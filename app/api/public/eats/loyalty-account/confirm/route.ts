import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import crypto from "crypto";
import { db } from "@/lib/db";
import { rateLimit, getClientIp } from "@/lib/rate-limit";

const schema = z.object({ email: z.string().email(), code: z.string().length(6) });

// POST /api/public/eats/loyalty-account/confirm — confirma el código y
// entrega un accessToken de larga duración que la app guarda en el
// dispositivo (junto al correo), para no pedir el código de nuevo en
// cada visita a "Mis sellos".
export async function POST(req: NextRequest) {
  // Código de 6 dígitos — sin este límite sería adivinable a fuerza
  // bruta dentro de los 15 minutos de validez (mismo criterio que el
  // resto de los códigos de verificación de la plataforma).
  const { allowed, retryAfterSeconds } = rateLimit(`loyalty-account-confirm:${getClientIp(req)}`, 10, 15 * 60_000);
  if (!allowed) {
    return NextResponse.json(
      { error: "Demasiados intentos. Espera un momento e intenta de nuevo." },
      { status: 429, headers: { "Retry-After": String(retryAfterSeconds) } }
    );
  }

  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Datos inválidos" }, { status: 400 });
  }
  const email = parsed.data.email.toLowerCase().trim();

  const account = await db.loyaltyAccountVerification.findUnique({ where: { email } });
  if (!account || !account.verificationCode || !account.verificationCodeExpiresAt) {
    return NextResponse.json({ error: "No hay un código pendiente. Pide uno nuevo." }, { status: 400 });
  }
  if (account.verificationCodeExpiresAt < new Date()) {
    return NextResponse.json({ error: "Ese código expiró. Pide uno nuevo." }, { status: 400 });
  }
  if (account.verificationCode !== parsed.data.code) {
    return NextResponse.json({ error: "El código no es correcto." }, { status: 400 });
  }

  const accessToken = crypto.randomBytes(32).toString("hex");
  await db.loyaltyAccountVerification.update({
    where: { email },
    data: {
      accessToken,
      verifiedAt: new Date(),
      verificationCode: null,
      verificationCodeExpiresAt: null,
    },
  });

  return NextResponse.json({ accessToken });
}
