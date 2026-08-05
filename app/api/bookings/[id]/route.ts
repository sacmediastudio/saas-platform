import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireTenant } from "@/lib/auth";

const schema = z.object({
  status: z.enum(["PENDING", "CONFIRMED", "CANCELLED", "COMPLETED"]),
});

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await requireTenant();

  const existing = await db.booking.findFirst({ where: { id: params.id, tenantId: session.tenantId } });
  if (!existing) {
    return NextResponse.json({ error: "Reserva no encontrada" }, { status: 404 });
  }

  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const booking = await db.booking.update({
    where: { id: params.id },
    data: { status: parsed.data.status },
  });

  // TODO: si status pasa a CONFIRMED o CANCELLED, disparar notificación
  // al cliente (ver lib/notifications.ts, pendiente de implementar).

  return NextResponse.json({ booking });
}
