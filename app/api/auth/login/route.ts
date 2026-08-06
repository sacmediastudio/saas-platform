import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import { signSession, sessionCookieName } from "@/lib/auth";

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export async function POST(req: NextRequest) {
  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Datos inválidos" }, { status: 400 });
  }

  const user = await db.user.findUnique({ where: { email: parsed.data.email } });
  const valid = user ? await bcrypt.compare(parsed.data.password, user.passwordHash) : false;

  // Mismo mensaje de error exista o no el usuario, para no filtrar
  // qué correos están registrados.
  if (!user || !valid) {
    return NextResponse.json({ error: "Correo o contraseña incorrectos" }, { status: 401 });
  }

  const token = signSession({ userId: user.id, tenantId: user.tenantId, role: user.role });
  const res = NextResponse.json({ ok: true });
  res.cookies.set(sessionCookieName, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });
  return res;
}
