import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/admin-auth";
import { withAuthErrors } from "@/lib/api-route";
import { popupData, popupSchema } from "@/lib/app-popup";

// POST /api/admin/popups — crea un pop-up (nace apagado salvo que se pida
// activo). Solo el admin de Zertoo: el espacio se vende aparte.
export function POST(req: NextRequest) {
  return withAuthErrors(async () => {
    await requireAdmin();
    const parsed = popupSchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: "Datos inválidos" }, { status: 400 });
    const popup = await db.appPopup.create({ data: { ...popupData(parsed.data), active: parsed.data.active ?? false } });
    return NextResponse.json({ popup }, { status: 201 });
  });
}
