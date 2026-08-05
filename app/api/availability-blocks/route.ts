import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireTenant } from "@/lib/auth";

const createSchema = z.object({
  staffId: z.string().optional(),
  startTime: z.string().datetime(),
  endTime: z.string().datetime(),
  reason: z.string().optional(),
});

// GET /api/availability-blocks?from=&to= — bloqueos del tenant en un rango.
export async function GET(req: NextRequest) {
  const session = await requireTenant();
  const { searchParams } = new URL(req.url);
  const from = searchParams.get("from");
  const to = searchParams.get("to");

  const blocks = await db.availabilityBlock.findMany({
    where: {
      tenantId: session.tenantId,
      ...(from && to ? { startTime: { gte: new Date(from) }, endTime: { lte: new Date(to) } } : {}),
    },
    orderBy: { startTime: "asc" },
  });

  return NextResponse.json({ blocks });
}

// POST /api/availability-blocks — el dueño marca un horario como no disponible
// (vacaciones, cierre por mantenimiento, almuerzo del staff, etc). El flujo
// público de reserva y el chequeo de conflictos en POST /api/bookings
// consultan esta tabla para no ofrecer/aceptar citas en ese rango.
export async function POST(req: NextRequest) {
  const session = await requireTenant();
  const parsed = createSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { startTime, endTime, ...rest } = parsed.data;
  if (new Date(endTime) <= new Date(startTime)) {
    return NextResponse.json({ error: "La hora de fin debe ser posterior al inicio" }, { status: 400 });
  }

  const block = await db.availabilityBlock.create({
    data: {
      tenantId: session.tenantId,
      startTime: new Date(startTime),
      endTime: new Date(endTime),
      ...rest,
    },
  });

  return NextResponse.json({ block }, { status: 201 });
}
