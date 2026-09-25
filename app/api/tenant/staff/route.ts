import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import crypto from "crypto";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import { requireOwner } from "@/lib/auth";
import { sendStaffInviteEmail } from "@/lib/email";
import { rateLimit } from "@/lib/rate-limit";

const createSchema = z.object({
  name: z.string().min(1).max(100),
  email: z.string().email(),
});

// GET /api/tenant/staff — solo el dueño ve y administra el equipo.
export async function GET() {
  const session = await requireOwner();
  const staff = await db.user.findMany({
    where: { tenantId: session.tenantId },
    select: { id: true, name: true, email: true, role: true, permissions: true, createdAt: true },
    orderBy: { createdAt: "asc" },
  });
  return NextResponse.json({ staff });
}

// POST /api/tenant/staff — el dueño agrega una cuenta de staff. No le
// asigna una contraseña él mismo: genera un hash inutilizable (el
// campo no admite null) y deja el mismo mecanismo de "elegí tu
// contraseña" que ya usa "Olvidé mi contraseña", para no duplicar ese
// flujo — el link llega por correo y, si Resend no está configurado,
// se devuelve en la respuesta para que el dueño se lo pase a mano.
export async function POST(req: NextRequest) {
  const session = await requireOwner();

  const { allowed, retryAfterSeconds } = rateLimit(`staff-invite:${session.tenantId}`, 20, 60 * 60_000);
  if (!allowed) {
    return NextResponse.json(
      { error: "Demasiados intentos. Espera un momento e intenta de nuevo." },
      { status: 429, headers: { "Retry-After": String(retryAfterSeconds) } }
    );
  }

  const parsed = createSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Datos inválidos" }, { status: 400 });
  }
  const email = parsed.data.email.toLowerCase().trim();

  const existing = await db.user.findUnique({ where: { email } });
  if (existing) {
    return NextResponse.json({ error: "Ese correo ya está registrado en Zertoo." }, { status: 409 });
  }

  const [tenant, randomPasswordHash] = await Promise.all([
    db.tenant.findUnique({ where: { id: session.tenantId }, select: { name: true } }),
    bcrypt.hash(crypto.randomBytes(32).toString("hex"), 10),
  ]);
  if (!tenant) return NextResponse.json({ error: "No encontrado" }, { status: 404 });

  const passwordResetToken = crypto.randomBytes(32).toString("hex");
  const passwordResetTokenExpiresAt = new Date(Date.now() + 60 * 60_000); // 1 hora, mismo criterio que reset de contraseña

  const staffUser = await db.user.create({
    data: {
      tenantId: session.tenantId,
      email,
      name: parsed.data.name,
      role: "STAFF",
      passwordHash: randomPasswordHash,
      // Ya controla el correo por definición (el link para elegir
      // contraseña le llega ahí) — no hace falta el paso de
      // verificación normal del signup.
      emailVerified: true,
      passwordResetToken,
      passwordResetTokenExpiresAt,
      passwordResetSentAt: new Date(),
    },
    select: { id: true, name: true, email: true, role: true, permissions: true, createdAt: true },
  });

  const origin = req.headers.get("origin") || `https://${req.headers.get("host")}`;
  const setPasswordUrl = `${origin}/reset-password?token=${passwordResetToken}`;

  await sendStaffInviteEmail({
    to: email,
    staffName: parsed.data.name,
    businessName: tenant.name,
    setPasswordUrl,
  }).catch((err) => console.error("No se pudo enviar la invitación de staff:", err));

  return NextResponse.json({ staff: staffUser, setPasswordUrl }, { status: 201 });
}
