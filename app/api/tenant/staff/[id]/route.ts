import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireOwner } from "@/lib/auth";

// DELETE /api/tenant/staff/[id] — el dueño quita una cuenta de staff.
// A propósito solo puede borrar cuentas STAFF, nunca OWNER (ni la
// suya propia ni la de otro dueño) — evita que alguien se quede sin
// acceso a su propio negocio por error.
export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await requireOwner();

  const target = await db.user.findFirst({ where: { id: params.id, tenantId: session.tenantId } });
  if (!target) return NextResponse.json({ error: "No encontrado" }, { status: 404 });
  if (target.role !== "STAFF") {
    return NextResponse.json({ error: "No se puede quitar una cuenta de dueño desde acá." }, { status: 400 });
  }

  await db.user.delete({ where: { id: params.id } });
  return NextResponse.json({ ok: true });
}
