import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { rateLimit, getClientIp } from "@/lib/rate-limit";
import {
  emailSchema,
  normalizeEmail,
  newAccessToken,
  codeIsValid,
  CODE_ERRORS,
  errorResponse,
  tooManyAttempts,
} from "@/lib/eats-account";

const schema = z.object({ email: emailSchema, code: z.string().length(6) });

// POST /api/public/eats/account/verify — confirma el código del registro:
// activa la contraseña pendiente y entrega el accessToken de la sesión.
export async function POST(req: NextRequest) {
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return errorResponse("Datos inválidos", 400);
  const email = normalizeEmail(parsed.data.email);

  // 6 dígitos son adivinables a fuerza bruta: se limita por IP y por correo.
  const ip = rateLimit(`eats-account-verify-ip:${getClientIp(req)}`, 15, 15 * 60_000);
  const mail = rateLimit(`eats-account-verify-email:${email}`, 8, 15 * 60_000);
  if (!ip.allowed || !mail.allowed) return tooManyAttempts(Math.max(ip.retryAfterSeconds, mail.retryAfterSeconds));

  const account = await db.loyaltyAccountVerification.findUnique({ where: { email } });
  if (!account || !account.pendingPasswordHash) return errorResponse(CODE_ERRORS.missing, 400);

  const check = codeIsValid(account, parsed.data.code);
  if (check !== "ok") return errorResponse(CODE_ERRORS[check], 400);

  const accessToken = account.accessToken ?? newAccessToken();
  await db.loyaltyAccountVerification.update({
    where: { email },
    data: {
      passwordHash: account.pendingPasswordHash,
      pendingPasswordHash: null,
      verificationCode: null,
      verificationCodeExpiresAt: null,
      accessToken,
      verifiedAt: new Date(),
    },
  });

  return NextResponse.json({ accessToken, name: account.name });
}
