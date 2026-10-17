import { NextRequest } from "next/server";
import { z } from "zod";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { rateLimit, getClientIp } from "@/lib/rate-limit";
import { isReviewDemoEmail } from "@/lib/review-demo";
import {
  emailSchema,
  passwordSchema,
  languageSchema,
  normalizeEmail,
  hashPassword,
  issueCode,
  errorResponse,
  tooManyAttempts,
} from "@/lib/eats-account";

const schema = z.object({
  name: z.string().trim().min(1, "Escribe tu nombre.").max(100),
  email: emailSchema,
  password: passwordSchema,
  language: languageSchema,
});

// POST /api/public/eats/account/register — crea (o reintenta crear) la
// cuenta de Zertoo Eats: guarda nombre y contraseña como PENDIENTES y
// manda un código de 6 dígitos al correo. La cuenta recién queda activa
// al confirmarlo en /verify, así nadie puede registrar un correo ajeno.
export async function POST(req: NextRequest) {
  const limit = rateLimit(`eats-account-register:${getClientIp(req)}`, 10, 60 * 60_000);
  if (!limit.allowed) return tooManyAttempts(limit.retryAfterSeconds);

  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return errorResponse(parsed.error.issues[0]?.message ?? "Datos inválidos", 400);
  }
  const email = normalizeEmail(parsed.data.email);
  const { name, password, language } = parsed.data;

  // La cuenta demo de App Review ya existe y no recibe correos.
  if (isReviewDemoEmail(email)) return errorResponse("Ese correo ya tiene una cuenta. Inicia sesión.", 409);

  const existing = await db.loyaltyAccountVerification.findUnique({ where: { email } });
  if (existing?.passwordHash) {
    return errorResponse("Ese correo ya tiene una cuenta. Inicia sesión.", 409);
  }

  const result = await issueCode({
    email,
    purpose: "verify",
    name,
    language,
    data: { name, pendingPasswordHash: await hashPassword(password) },
  });
  if (!result.ok) {
    return errorResponse(`Espera ${result.waitSeconds} segundos antes de pedir otro código.`, 429);
  }
  return NextResponse.json({ ok: true });
}
