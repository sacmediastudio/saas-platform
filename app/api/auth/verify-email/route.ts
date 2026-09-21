import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireTenant } from "@/lib/auth";
import { rateLimit } from "@/lib/rate-limit";

const schema = z.object({ code: z.string().length(6) });

export async function POST(req: NextRequest) {
  const session = await requireTenant();

  // Sin esto, el código de 6 dígitos (1 en 1,000,000) sería adivinable
  // a fuerza bruta dentro de la ventana de 15 minutos en la que es
  // válido — 10 intentos cada 15 minutos deja pasar los típicos errores
  // de tipeo pero hace inviable adivinarlo.
  const { allowed, retryAfterSeconds } = rateLimit(`verify-email:${session.userId}`, 10, 15 * 60_000);
  if (!allowed) {
    return NextResponse.json(
      { error: "Demasiados intentos. Espera un momento e intenta de nuevo." },
      { status: 429, headers: { "Retry-After": String(retryAfterSeconds) } }
    );
  }

  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Código inválido" }, { status: 400 });
  }

  const user = await db.user.findUnique({ where: { id: session.userId } });
  if (!user) return NextResponse.json({ error: "No encontrado" }, { status: 404 });

  if (user.emailVerified) {
    return NextResponse.json({ ok: true, alreadyVerified: true });
  }

  if (!user.verificationCode || !user.verificationCodeExpiresAt) {
    return NextResponse.json(
      { error: "No hay un código pendiente. Pide que te reenvíen uno." },
      { status: 400 }
    );
  }

  if (user.verificationCodeExpiresAt < new Date()) {
    return NextResponse.json({ error: "Ese código expiró. Pide uno nuevo." }, { status: 400 });
  }

  if (user.verificationCode !== parsed.data.code) {
    return NextResponse.json({ error: "El código no es correcto." }, { status: 400 });
  }

  await db.user.update({
    where: { id: user.id },
    data: {
      emailVerified: true,
      verificationCode: null,
      verificationCodeExpiresAt: null,
    },
  });

  return NextResponse.json({ ok: true });
}
