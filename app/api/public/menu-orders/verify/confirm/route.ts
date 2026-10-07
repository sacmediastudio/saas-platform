import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { rateLimit, getClientIp } from "@/lib/rate-limit";
import { confirmCode, normalizeOrderPhone } from "@/lib/order-verification";

const schema = z.object({ phone: z.string().min(6).max(30), code: z.string().length(6) });

// POST /api/public/menu-orders/verify/confirm — valida el código y
// entrega un token que el navegador guarda; el pedido de delivery lo
// manda de vuelta para demostrar que ese teléfono/correo fue verificado.
export async function POST(req: NextRequest) {
  const { allowed, retryAfterSeconds } = rateLimit(`order-verify-confirm:${getClientIp(req)}`, 15, 15 * 60_000);
  if (!allowed) {
    return NextResponse.json(
      { error: "Demasiados intentos. Espera un momento e intenta de nuevo." },
      { status: 429, headers: { "Retry-After": String(retryAfterSeconds) } }
    );
  }

  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Datos inválidos" }, { status: 400 });

  const result = await confirmCode(normalizeOrderPhone(parsed.data.phone), parsed.data.code);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });
  return NextResponse.json({ token: result.token });
}
