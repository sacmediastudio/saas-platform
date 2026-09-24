import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireTenant } from "@/lib/auth";

const updateSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  address: z.string().max(300).nullable().optional(),
  contactPhone: z.string().max(30).nullable().optional(),
  pickupEnabled: z.boolean().optional(),
  deliveryEnabled: z.boolean().optional(),
  deliveryFee: z.number().min(0).nullable().optional(),
  minDeliveryAmount: z.number().min(0).nullable().optional(),
  isActive: z.boolean().optional(),
});

async function findOwnedLocation(tenantId: string, id: string) {
  return db.location.findFirst({ where: { id, tenantId } });
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await requireTenant();
  const existing = await findOwnedLocation(session.tenantId, params.id);
  if (!existing) return NextResponse.json({ error: "Ubicación no encontrada" }, { status: 404 });

  const parsed = updateSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const location = await db.location.update({
    where: { id: params.id },
    data: parsed.data,
  });

  return NextResponse.json({ location });
}

// No bloqueamos el borrado si ya tiene pedidos — a diferencia de una
// categoría de menú, acá no tiene sentido pedirle al negocio que
// "mueva" pedidos viejos a otra ubicación. onDelete: SetNull en el
// schema deja esos pedidos con locationId null, sin perder el pedido.
export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await requireTenant();
  const existing = await findOwnedLocation(session.tenantId, params.id);
  if (!existing) return NextResponse.json({ error: "Ubicación no encontrada" }, { status: 404 });

  await db.location.delete({ where: { id: params.id } });
  return NextResponse.json({ ok: true });
}
