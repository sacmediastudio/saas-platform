import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import { signAdminSession, adminCookieName } from "@/lib/admin-auth";

const schema = z.object({ email: z.string().email(), password: z.string().min(1) });

export async function POST(req: NextRequest) {
  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Datos inválidos" }, { status: 400 });
  }

  const admin = await db.adminUser.findUnique({ where: { email: parsed.data.email } });
  const valid = admin ? await bcrypt.compare(parsed.data.password, admin.passwordHash) : false;

  if (!admin || !valid) {
    return NextResponse.json({ error: "Correo o contraseña incorrectos" }, { status: 401 });
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
