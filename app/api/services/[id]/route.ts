import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireTenant } from "@/lib/auth";

const updateSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().nullable().optional(),
  imageUrl: z.string().min(1).nullable().optional(),
  durationMinutes: z.number().int().positive().optional(),
  price: z.number().positive().optional(),
  staffId: z.string().nullable().optional(),
});

async function findOwnedService(tenantId: string, id: string) {
  return db.service.findFirst({ where: { id, tenantId } });
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await requireTenant();
  const existing = await findOwnedService(session.tenantId, params.id);
  if (!existing) {
    return NextResponse.json({ error: "Servicio no encontrado" }, { status: 404 });
  }

  const parsed = updateSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const service = await db.service.update({ where: { id: params.id }, data: parsed.data });
  return NextResponse.json({ service: { ...service, price: Number(service.price) } });
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await requireTenant();
  const existing = await findOwnedService(session.tenantId, params.id);
  if (!existing) {
    return NextResponse.json({ error: "Servicio no encontrado" }, { status: 404 });
  }

  const bookingCount = await db.booking.count({ where: { serviceId: params.id } });
  if (bookingCount > 0) {
    return NextResponse.json(
      { error: `Este servicio tiene ${bookingCount} cita(s) asociada(s) y no se puede borrar.` },
      { status: 409 }
    );
  }

  await db.service.delete({ where: { id: params.id } });
  return NextResponse.json({ ok: true });
}
