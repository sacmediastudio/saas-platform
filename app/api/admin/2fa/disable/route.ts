import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/admin-auth";
import { verifyTwoFactorToken } from "@/lib/two-factor";

const schema = z.object({ token: z.string().min(6).max(6) });

// POST /api/admin/2fa/disable — exige un código de 6 dígitos VÁLIDO
// para desactivar, a propósito — así, si alguien roba la sesión del
// admin (pero no su teléfono), no puede bajar esta protección solo con
// eso.
export async function POST(req: NextRequest) {
  const admin = await requireAdmin();

  if (!admin.twoFactorEnabled || !admin.twoFactorSecret) {
    return NextResponse.json({ error: "La verificación en dos pasos no está activa." }, { status: 400 });
  }

  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Código inválido" }, { status: 400 });
  }

  if (!verifyTwoFactorToken(parsed.data.token, admin.twoFactorSecret)) {
    return NextResponse.json({ error: "Código incorrecto" }, { status: 400 });
  }

  await db.adminUser.update({
    where: { id: admin.id },
    data: { twoFactorSecret: null, twoFactorEnabled: false },
  });

  return NextResponse.json({ ok: true });
}
