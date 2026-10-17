import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import { rateLimit, getClientIp } from "@/lib/rate-limit";
import { isReviewDemoEmail, reviewDemoCodeMatches } from "@/lib/review-demo";
import {
  emailSchema,
  languageSchema,
  normalizeEmail,
  newAccessToken,
  issueCode,
  errorResponse,
  tooManyAttempts,
} from "@/lib/eats-account";

const schema = z.object({ email: emailSchema, password: z.string().min(1).max(100), language: languageSchema });

const BAD_CREDENTIALS = "Correo o contraseña incorrectos.";

// POST /api/public/eats/account/login — correo + contraseña.
export async function POST(req: NextRequest) {
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return errorResponse("Datos inválidos", 400);
  const email = normalizeEmail(parsed.data.email);
  const { password, language } = parsed.data;

  const ip = rateLimit(`eats-account-login-ip:${getClientIp(req)}`, 20, 15 * 60_000);
  const mail = rateLimit(`eats-account-login-email:${email}`, 10, 15 * 60_000);
  if (!ip.allowed || !mail.allowed) return tooManyAttempts(Math.max(ip.retryAfterSeconds, mail.retryAfterSeconds));

  // Cuenta demo de App Review: la "contraseña" es REVIEW_DEMO_CODE.
  if (isReviewDemoEmail(email)) {
    if (!reviewDemoCodeMatches(password)) return errorResponse(BAD_CREDENTIALS, 401);
    const demoToken = newAccessToken();
    await db.loyaltyAccountVerification.upsert({
      where: { email },
      update: { accessToken: demoToken, verifiedAt: new Date(), name: "App Review" },
      create: { email, accessToken: demoToken, verifiedAt: new Date(), name: "App Review" },
    });
    return NextResponse.json({ accessToken: demoToken, name: "App Review" });
  }

  const account = await db.loyaltyAccountVerification.findUnique({ where: { email } });

  if (account?.passwordHash && (await bcrypt.compare(password, account.passwordHash))) {
    const accessToken = account.accessToken ?? newAccessToken();
    await db.loyaltyAccountVerification.update({
      where: { email },
      data: { accessToken, verifiedAt: account.verifiedAt ?? new Date() },
    });
    return NextResponse.json({ accessToken, name: account.name });
  }

  // Se registró pero nunca confirmó el correo: se le manda un código
  // nuevo y la app lo lleva directo al paso del código.
  if (account && !account.passwordHash && account.pendingPasswordHash) {
    if (await bcrypt.compare(password, account.pendingPasswordHash)) {
      const sent = await issueCode({ email, purpose: "verify", name: account.name, language });
      if (!sent.ok) {
        return errorResponse(`Espera ${sent.waitSeconds} segundos antes de pedir otro código.`, 429, {
          code: "UNVERIFIED",
        });
      }
      return errorResponse("Tu cuenta todavía no está verificada. Te enviamos un código nuevo.", 403, {
        code: "UNVERIFIED",
      });
    }
  }

  return errorResponse(BAD_CREDENTIALS, 401);
}
