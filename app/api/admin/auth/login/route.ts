import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import { signAdminSession, adminCookieName, signPendingTwoFactor, pendingTwoFactorCookieName } from "@/lib/admin-auth";
import { rateLimit, getClientIp } from "@/lib/rate-limit";

const schema = z.object({ email: z.string().email(), password: z.string().min(1) });

export async function POST(req: NextRequest) {
  const { allowed, retryAfterSeconds } = rateLimit(`admin-login:${getClientIp(req)}`, 10, 15 * 60_000);
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

  const admin = await db.adminUser.findUnique({ where: { email: parsed.data.email } });
  const valid = admin ? await bcrypt.compare(parsed.data.password, admin.passwordHash) : false;

  if (!admin || !valid) {
    return NextResponse.json({ error: "Correo o contraseña incorrectos" }, { status: 401 });
  }

  // Si tiene 2FA activo, todavía no le damos la sesión real — solo un
  // token de 5 minutos que únicamente sirve para el siguiente paso
  // (mandar el código de 6 dígitos), no para acceder a nada del panel.
  if (admin.twoFactorEnabled) {
    const pendingToken = signPendingTwoFactor(admin.id);
    const res = NextResponse.json({ needsTwoFactor: true });
    res.cookies.set(pendingTwoFactorCookieName, pendingToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 5 * 60,
    });
    return res;
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
  return res;
}
