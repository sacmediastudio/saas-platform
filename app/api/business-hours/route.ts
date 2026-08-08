import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireTenant } from "@/lib/auth";
import { getBusinessHours } from "@/lib/availability";

export async function GET() {
  const session = await requireTenant();
  const [hours, tenant] = await Promise.all([
    getBusinessHours(session.tenantId),
    db.tenant.findUnique({ where: { id: session.tenantId }, select: { bufferMinutes: true } }),
  ]);
  return NextResponse.json({ hours, bufferMinutes: tenant?.bufferMinutes ?? 15 });
}

const daySchema = z.object({
  dayOfWeek: z.number().int().min(0).max(6),
  isOpen: z.boolean(),
  startTime: z.string().regex(/^\d{2}:\d{2}$/),
  endTime: z.string().regex(/^\d{2}:\d{2}$/),
});

const putSchema = z.object({
  days: z.array(daySchema).length(7),
  bufferMinutes: z.number().int().min(0).max(120),
});

// PUT /api/business-hours — reemplaza el horario completo (las 7 filas)
// y el buffer, en una sola operación.
export async function PUT(req: NextRequest) {
  const session = await requireTenant();
  const parsed = putSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  for (const day of parsed.data.days) {
    if (day.endTime <= day.startTime) {
      return NextResponse.json(
        { error: "La hora de cierre debe ser posterior a la de apertura." },
        { status: 400 }
      );
    }
  }

  await db.$transaction([
    ...parsed.data.days.map((day) =>
      db.businessHours.upsert({
        where: { tenantId_dayOfWeek: { tenantId: session.tenantId, dayOfWeek: day.dayOfWeek } },
        update: { isOpen: day.isOpen, startTime: day.startTime, endTime: day.endTime },
        create: { tenantId: session.tenantId, ...day },
      })
    ),
    db.tenant.update({
      where: { id: session.tenantId },
      data: { bufferMinutes: parsed.data.bufferMinutes },
    }),
  ]);

  return NextResponse.json({ ok: true });
}
