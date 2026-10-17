import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { rateLimit, getClientIp } from "@/lib/rate-limit";
import { isReviewDemoEmail } from "@/lib/review-demo";
import { emailSchema, languageSchema, normalizeEmail, issueCode, errorResponse, tooManyAttempts } from "@/lib/eats-account";

const schema = z.object({ email: emailSchema, language: languageSchema });

// POST /api/public/eats/account/forgot — manda un código para restablecer
// la contraseña. Siempre responde ok (exista o no la cuenta) para no
// revelar qué correos están registrados.
export async function POST(req: NextRequest) {
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return errorResponse("Datos inválidos", 400);
  const email = normalizeEmail(parsed.data.email);

  const ip = rateLimit(`eats-account-forgot-ip:${getClientIp(req)}`, 5, 60 * 60_000);
  const mail = rateLimit(`eats-account-forgot-email:${email}`, 3, 60 * 60_000);
  if (!ip.allowed || !mail.allowed) return tooManyAttempts(Math.max(ip.retryAfterSeconds, mail.retryAfterSeconds));

  if (isReviewDemoEmail(email)) return NextResponse.json({ ok: true });

  const account = await db.loyaltyAccountVerification.findUnique({ where: { email } });
  if (account?.passwordHash) {
    await issueCode({ email, purpose: "reset", name: account.name, language: parsed.data.language });
  }
  return NextResponse.json({ ok: true });
}
