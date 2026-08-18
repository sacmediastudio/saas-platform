import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { signAdminSession, adminCookieName, verifyPendingTwoFactor, pendingTwoFactorCookieName } from "@/lib/admin-auth";
import { verifyTwoFactorToken } from "@/lib/two-factor";
import { rateLimit, getClientIp } from "@/lib/rate-limit";

const schema = z.object({ token: z.string().min(6).max(6) });

// POST /api/admin/auth/verify-2fa — segundo paso del login: valida el
// código de 6 dígitos contra el token pendiente (emitido tras la
// contraseña correcta) y recién ahí entrega la sesión real.
export async function POST(req: NextRequest) {
  const { allowed, retryAfterSeconds } = rateLimit(`admin-2fa:${getClientIp(req)}`, 10, 15 * 60_000);
  if (!allowed) {
    return NextResponse.json(
      { error: "Demasiados intentos. Espera un momento e intenta de nuevo." },
      { status: 429, headers: { "Retry-After": String(retryAfterSeconds) } }
    );
  }

  const pendingCookie = req.cookies.get(pendingTwoFactorCookieName)?.value;
  const pending = pendingCookie ? verifyPendingTwoFactor(pendingCookie) : null;
  if (!pending) {
    return NextResponse.json({ error: "Tu sesión de login expiró — vuelve a entrar." }, { status: 401 });
  }

  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Código inválido" }, { status: 400 });
  }

  const admin = await db.adminUser.findUnique({ where: { id: pending.adminId } });
  if (!admin || !admin.twoFactorEnabled || !admin.twoFactorSecret) {
    return NextResponse.json({ error: "No se pudo verificar" }, { status: 401 });
  }

  if (!verifyTwoFactorToken(parsed.data.token, admin.twoFactorSecret)) {
    return NextResponse.json({ error: "Código incorrecto" }, { status: 401 });
  }

  const token = signAdminSession({ adminId: admin.id });
  const res = NextResponse.json({ ok: true });
  res.cookies.set(adminCookieName, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });
  // Ya cumplió su propósito — se limpia para que no quede ninguna
  // cookie "a medio camino" dando vueltas.
  res.cookies.delete(pendingTwoFactorCookieName);
  return res;
}
