import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import crypto from "crypto";
import { db } from "@/lib/db";
import { sendPasswordResetEmail } from "@/lib/email";

const schema = z.object({ email: z.string().email() });

const COOLDOWN_MS = 30_000; // mismo criterio que el reenvío de verificación de correo

// POST /api/auth/forgot-password — SIEMPRE responde {ok:true} exista o
// no el correo, para no dejarle saber a nadie qué correos están
// registrados en la plataforma.
export async function POST(req: NextRequest) {
  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ ok: true }); // mismo criterio: no revelar nada por el formato tampoco
  }

  const user = await db.user.findUnique({ where: { email: parsed.data.email.toLowerCase().trim() } });

  if (user) {
    const onCooldown =
      user.passwordResetSentAt && Date.now() - user.passwordResetSentAt.getTime() < COOLDOWN_MS;

    if (!onCooldown) {
      const token = crypto.randomBytes(32).toString("hex");
      const expiresAt = new Date(Date.now() + 60 * 60_000); // 1 hora

      await db.user.update({
        where: { id: user.id },
        data: {
          passwordResetToken: token,
          passwordResetTokenExpiresAt: expiresAt,
          passwordResetSentAt: new Date(),
        },
      });

      const origin = req.headers.get("origin") || `https://${req.headers.get("host")}`;
      const resetUrl = `${origin}/reset-password?token=${token}`;

      await sendPasswordResetEmail(user.email, resetUrl, user.name).catch((err) =>
        console.error("No se pudo enviar el correo de recuperación:", err)
      );
    }
  }

  return NextResponse.json({ ok: true });
}
