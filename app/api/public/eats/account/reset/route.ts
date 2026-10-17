import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { rateLimit, getClientIp } from "@/lib/rate-limit";
import {
  emailSchema,
  passwordSchema,
  normalizeEmail,
  hashPassword,
  newAccessToken,
  codeIsValid,
  CODE_ERRORS,
  errorResponse,
  tooManyAttempts,
} from "@/lib/eats-account";

const schema = z.object({ email: emailSchema, code: z.string().length(6), password: passwordSchema });

// POST /api/public/eats/account/reset — código + contraseña nueva. Rota
// el accessToken, así cualquier sesión anterior queda cerrada.
export async function POST(req: NextRequest) {
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return errorResponse(parsed.error.issues[0]?.message ?? "Datos inválidos", 400);
  const email = normalizeEmail(parsed.data.email);

  const ip = rateLimit(`eats-account-reset-ip:${getClientIp(req)}`, 15, 15 * 60_000);
  const mail = rateLimit(`eats-account-reset-email:${email}`, 8, 15 * 60_000);
  if (!ip.allowed || !mail.allowed) return tooManyAttempts(Math.max(ip.retryAfterSeconds, mail.retryAfterSeconds));

  const account = await db.loyaltyAccountVerification.findUnique({ where: { email } });
  if (!account?.passwordHash) return errorResponse(CODE_ERRORS.missing, 400);

  const check = codeIsValid(account, parsed.data.code);
  if (check !== "ok") return errorResponse(CODE_ERRORS[check], 400);

  const accessToken = newAccessToken();
  await db.loyaltyAccountVerification.update({
    where: { email },
    data: {
      passwordHash: await hashPassword(parsed.data.password),
      pendingPasswordHash: null,
      verificationCode: null,
      verificationCodeExpiresAt: null,
      accessToken,
      verifiedAt: account.verifiedAt ?? new Date(),
    },
  });
  return NextResponse.json({ accessToken, name: account.name });
}
