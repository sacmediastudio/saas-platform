import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/admin-auth";
import { withAuthErrors } from "@/lib/api-route";
import { popupData, popupSchema } from "@/lib/app-popup";

// PATCH /api/admin/popups/[id] — edita el pop-up completo, o solo
// { active } para el interruptor de la lista.
export function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  return withAuthErrors(async () => {
    await requireAdmin();
    const body = await req.json().catch(() => null);
    const existing = await db.appPopup.findUnique({ where: { id: params.id } });
    if (!existing) return NextResponse.json({ error: "No encontrado" }, { status: 404 });

    if (body && typeof body === "object" && Object.keys(body).length === 1 && typeof body.active === "boolean") {
      const popup = await db.appPopup.update({ where: { id: params.id }, data: { active: body.active } });
      return NextResponse.json({ popup });
    }

    const parsed = popupSchema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: "Datos inválidos" }, { status: 400 });
    const popup = await db.appPopup.update({ where: { id: params.id }, data: popupData(parsed.data) });
    return NextResponse.json({ popup });
  });
}

export function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  return withAuthErrors(async () => {
    await requireAdmin();
    await db.appPopup.deleteMany({ where: { id: params.id } });
    return NextResponse.json({ ok: true });
  });
}
