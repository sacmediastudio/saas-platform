import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import { signSession, sessionCookieName } from "@/lib/auth";

const schema = z.object({
  token: z.string().min(1),
  password: z.string().min(8, "La contraseña debe tener al menos 8 caracteres"),
});

// POST /api/auth/reset-password — valida el token del link del correo
// y actualiza la contraseña. Lo deja con sesión iniciada de una vez,
// para no hacerle pasar por el login después de esto.
export async function POST(req: NextRequest) {
  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.errors[0]?.message ?? "Datos inválidos" }, { status: 400 });
  }

  const user = await db.user.findUnique({ where: { passwordResetToken: parsed.data.token } });
  if (!user || !user.passwordResetTokenExpiresAt || user.passwordResetTokenExpiresAt < new Date()) {
    return NextResponse.json(
      { error: "Este link ya no es válido — pide uno nuevo desde 'Olvidé mi contraseña'." },
      { status: 400 }
    );
  }

  const passwordHash = await bcrypt.hash(parsed.data.password, 10);

  await db.user.update({
    where: { id: user.id },
    data: {
      passwordHash,
      // El token se usa una sola vez — se limpia para que ese mismo
      // link no sirva de nuevo si alguien lo vuelve a abrir.
      passwordResetToken: null,
      passwordResetTokenExpiresAt: null,
    },
  });

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
