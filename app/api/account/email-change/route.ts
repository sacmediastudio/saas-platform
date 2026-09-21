import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import { requireTenant } from "@/lib/auth";
import { sendEmailChangeVerification, generateVerificationCode } from "@/lib/email";
import { rateLimit, getClientIp } from "@/lib/rate-limit";

const requestSchema = z.object({
  newEmail: z.string().email(),
  currentPassword: z.string().min(1),
});

const COOLDOWN_MS = 30_000; // mismo criterio que el reenvío de verificación de correo

// GET /api/account/email-change — estado actual (correo de acceso + si hay un cambio pendiente).
export async function GET() {
  const session = await requireTenant();
  const user = await db.user.findUnique({ where: { id: session.userId } });
  if (!user) return NextResponse.json({ error: "No encontrado" }, { status: 404 });

  return NextResponse.json({
    email: user.email,
    pendingEmail: user.pendingEmail,
  });
}

// POST /api/account/email-change — pide el cambio: valida la contraseña actual,
// que el correo nuevo no esté en uso, y manda un código de 6 dígitos al correo nuevo.
export async function POST(req: NextRequest) {
  const session = await requireTenant();

  const { allowed, retryAfterSeconds } = rateLimit(`email-change:${getClientIp(req)}`, 10, 60 * 60_000);
  if (!allowed) {
    return NextResponse.json(
      { error: "Demasiados intentos. Espera un momento e intenta de nuevo." },
      { status: 429, headers: { "Retry-After": String(retryAfterSeconds) } }
    );
  }

  const parsed = requestSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Datos inválidos" }, { status: 400 });
  }

  const user = await db.user.findUnique({
    where: { id: session.userId },
    include: { tenant: { select: { name: true } } },
  });
  if (!user) return NextResponse.json({ error: "No encontrado" }, { status: 404 });

  const validPassword = await bcrypt.compare(parsed.data.currentPassword, user.passwordHash);
  if (!validPassword) {
    return NextResponse.json({ error: "La contraseña actual no es correcta." }, { status: 401 });
  }

  const newEmail = parsed.data.newEmail.toLowerCase().trim();
  if (newEmail === user.email) {
    return NextResponse.json({ error: "Ese ya es tu correo actual." }, { status: 400 });
  }

  const taken = await db.user.findUnique({ where: { email: newEmail } });
  if (taken) {
    return NextResponse.json({ error: "Ese correo ya está en uso por otra cuenta." }, { status: 400 });
  }

  if (user.emailChangeCodeSentAt && Date.now() - user.emailChangeCodeSentAt.getTime() < COOLDOWN_MS) {
    const waitSeconds = Math.ceil(
      (COOLDOWN_MS - (Date.now() - user.emailChangeCodeSentAt.getTime())) / 1000
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
      pendingEmail: newEmail,
      emailChangeCode: code,
      emailChangeCodeExpiresAt: expiresAt,
      emailChangeCodeSentAt: new Date(),
    },
  });

  await sendEmailChangeVerification(newEmail, code, user.tenant.name).catch((err) =>
    console.error("No se pudo enviar el correo de cambio de correo:", err)
  );

  return NextResponse.json({ ok: true, pendingEmail: newEmail });
}

// DELETE /api/account/email-change — cancela un cambio de correo pendiente.
export async function DELETE() {
  const session = await requireTenant();
  await db.user.update({
    where: { id: session.userId },
    data: {
      pendingEmail: null,
      emailChangeCode: null,
      emailChangeCodeExpiresAt: null,
    },
  });
  return NextResponse.json({ ok: true });
}
