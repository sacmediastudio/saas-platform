import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { rateLimit, getClientIp } from "@/lib/rate-limit";

const schema = z.object({ email: z.string().email(), token: z.string().min(1) });

// DELETE /api/public/eats/loyalty-account/delete — borra la cuenta de
// fidelidad del cliente (Apple exige que toda app que permite crear una
// cuenta también permita eliminarla desde adentro). Solo borra el
// registro de verificación e invalida el accessToken; las tarjetas de
// sellos (LoyaltyCard) quedan intactas, son el historial de visitas del
// NEGOCIO, no datos de esta cuenta — el borrado completo de esos datos
// sigue disponible a pedido vía /eliminar-datos.
export async function DELETE(req: NextRequest) {
  const { allowed, retryAfterSeconds } = rateLimit(`loyalty-account-delete:${getClientIp(req)}`, 10, 15 * 60_000);
  if (!allowed) {
    return NextResponse.json(
      { error: "Demasiados intentos. Espera un momento e intenta de nuevo." },
      { status: 429, headers: { "Retry-After": String(retryAfterSeconds) } }
    );
  }

  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Datos inválidos" }, { status: 400 });
  }
  const email = parsed.data.email.toLowerCase().trim();

  const account = await db.loyaltyAccountVerification.findUnique({ where: { email } });
  if (!account || !account.verifiedAt || !account.accessToken || account.accessToken !== parsed.data.token) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  await db.loyaltyAccountVerification.delete({ where: { email } });

  return NextResponse.json({ ok: true });
}
