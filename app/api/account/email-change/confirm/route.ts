import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { requireTenant } from "@/lib/auth";
import { rateLimit } from "@/lib/rate-limit";

const schema = z.object({ code: z.string().length(6) });

// POST /api/account/email-change/confirm — confirma el código mandado al correo nuevo
// y recién ahí reemplaza `email`. Hasta este punto el correo viejo sigue funcionando.
export async function POST(req: NextRequest) {
  const session = await requireTenant();

  // Mismo criterio que verify-email: sin límite de intentos, el código de
  // 6 dígitos sería adivinable a fuerza bruta dentro de sus 15 minutos
  // de validez (por ejemplo, con una sesión robada por XSS, sin haber
  // recibido el correo real).
  const { allowed, retryAfterSeconds } = rateLimit(`email-change-confirm:${session.userId}`, 10, 15 * 60_000);
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

  if (!user.pendingEmail || !user.emailChangeCode || !user.emailChangeCodeExpiresAt) {
    return NextResponse.json(
      { error: "No hay un cambio de correo pendiente." },
      { status: 400 }
    );
  }

  if (user.emailChangeCodeExpiresAt < new Date()) {
    return NextResponse.json({ error: "Ese código expiró. Pide uno nuevo." }, { status: 400 });
  }

  if (user.emailChangeCode !== parsed.data.code) {
    return NextResponse.json({ error: "El código no es correcto." }, { status: 400 });
  }

  try {
    const updated = await db.user.update({
      where: { id: user.id },
      data: {
        email: user.pendingEmail,
        pendingEmail: null,
        emailChangeCode: null,
        emailChangeCodeExpiresAt: null,
        emailChangeCodeSentAt: null,
      },
    });
    return NextResponse.json({ ok: true, email: updated.email });
  } catch (err) {
    // Alguien más tomó ese correo mientras el código estaba pendiente.
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      return NextResponse.json(
        { error: "Ese correo se registró en otra cuenta mientras tanto. Pedí el cambio con otro correo." },
        { status: 409 }
      );
    }
    throw err;
  }
}
