import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/admin-auth";
import { verifyTwoFactorToken } from "@/lib/two-factor";

const schema = z.object({ secret: z.string().min(1), token: z.string().min(6).max(6) });

// POST /api/admin/2fa/setup/confirm — recién acá se guarda el secreto
// de verdad, y solo si el código de 6 dígitos coincide — así
// confirmamos que el admin sí escaneó el QR correctamente antes de
// activar la protección (si guardáramos el secreto antes de esto, un
// error de escaneo podría dejarlo bloqueado de su propia cuenta).
export async function POST(req: NextRequest) {
  const admin = await requireAdmin();
  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Datos inválidos" }, { status: 400 });
  }

  if (!verifyTwoFactorToken(parsed.data.token, parsed.data.secret)) {
    return NextResponse.json({ error: "Código incorrecto — revisa la hora de tu teléfono e intenta de nuevo." }, { status: 400 });
  }

  await db.adminUser.update({
    where: { id: admin.id },
    data: { twoFactorSecret: parsed.data.secret, twoFactorEnabled: true },
  });

  return NextResponse.json({ ok: true });
}
