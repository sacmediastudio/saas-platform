import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireTenant } from "@/lib/auth";
import { sendVerificationEmail, generateVerificationCode } from "@/lib/email";

const COOLDOWN_MS = 30_000; // 30s entre reenvíos, para no facilitar spam/abuso

export async function POST() {
  const session = await requireTenant();
  const user = await db.user.findUnique({
    where: { id: session.userId },
    include: { tenant: { select: { name: true } } },
  });
  if (!user) return NextResponse.json({ error: "No encontrado" }, { status: 404 });

  if (user.emailVerified) {
    return NextResponse.json({ ok: true, alreadyVerified: true });
  }

  if (user.verificationCodeSentAt && Date.now() - user.verificationCodeSentAt.getTime() < COOLDOWN_MS) {
    const waitSeconds = Math.ceil(
      (COOLDOWN_MS - (Date.now() - user.verificationCodeSentAt.getTime())) / 1000
    );
    return NextResponse.json(
      { error: `Espera ${waitSeconds} segundos antes de pedir otro código.` },
      { status: 429 }
    );
  }

  const code = generateVerificationCode();
  const expiresAt = new Date(Date.now() + 15 * 60_000);

  await db.user.update({
    where: { id: user.id },
    data: {
      verificationCode: code,
      verificationCodeExpiresAt: expiresAt,
      verificationCodeSentAt: new Date(),
    },
  });

  await sendVerificationEmail(user.email, code, user.tenant.name).catch((err) =>
    console.error("No se pudo reenviar el correo de verificación:", err)
  );

  return NextResponse.json({ ok: true });
}
