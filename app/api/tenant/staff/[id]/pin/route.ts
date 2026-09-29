import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireOwner } from "@/lib/auth";
import { hashPin } from "@/lib/pin";

const schema = z.object({ pin: z.string().regex(/^\d{4}$/, "El PIN debe ser de 4 dígitos") });

// PUT /api/tenant/staff/[id]/pin — el dueño le asigna (o cambia) el PIN
// de 4 dígitos que ese staff usa para "fichar" en la tablet de Zertoo
// Waiter (Fase 2). Solo el dueño puede tocar esto, mismo criterio que
// PATCH /api/tenant/staff/[id] para los permisos.
export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await requireOwner();
  const target = await db.user.findFirst({ where: { id: params.id, tenantId: session.tenantId } });
  if (!target) return NextResponse.json({ error: "No encontrado" }, { status: 404 });

  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.errors[0]?.message ?? "PIN inválido" }, { status: 400 });
  }

  const pinHash = hashPin(parsed.data.pin);
  const clash = await db.user.findFirst({
    where: { tenantId: session.tenantId, pinHash, NOT: { id: target.id } },
  });
  if (clash) {
    return NextResponse.json({ error: "Ese PIN ya lo usa otro miembro del equipo — elegí otro." }, { status: 409 });
  }

  await db.user.update({ where: { id: target.id }, data: { pinHash } });
  return NextResponse.json({ ok: true });
}

// DELETE — le saca el PIN (deja de poder fichar hasta que se le asigne uno nuevo).
export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await requireOwner();
  const target = await db.user.findFirst({ where: { id: params.id, tenantId: session.tenantId } });
  if (!target) return NextResponse.json({ error: "No encontrado" }, { status: 404 });

  await db.user.update({ where: { id: target.id }, data: { pinHash: null } });
  return NextResponse.json({ ok: true });
}
