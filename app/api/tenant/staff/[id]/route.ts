import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireOwner } from "@/lib/auth";
import { PERMISSION_KEYS } from "@/lib/permissions";

const updateSchema = z.object({
  permissions: z.array(z.enum(PERMISSION_KEYS)),
});

// PATCH /api/tenant/staff/[id] — el dueño ajusta a qué secciones del
// dashboard tiene acceso ese staff puntual. Reemplaza la lista entera
// (no un add/remove incremental) — más simple del lado del cliente,
// que ya maneja el estado completo de los toggles.
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await requireOwner();

  const target = await db.user.findFirst({ where: { id: params.id, tenantId: session.tenantId } });
  if (!target) return NextResponse.json({ error: "No encontrado" }, { status: 404 });
  if (target.role !== "STAFF") {
    return NextResponse.json({ error: "El dueño siempre tiene acceso a todo — no aplica." }, { status: 400 });
  }

  const parsed = updateSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Datos inválidos" }, { status: 400 });
  }

  const updated = await db.user.update({
    where: { id: params.id },
    data: { permissions: parsed.data.permissions },
    select: { id: true, name: true, email: true, role: true, permissions: true, createdAt: true },
  });

  return NextResponse.json({ staff: updated });
}

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
