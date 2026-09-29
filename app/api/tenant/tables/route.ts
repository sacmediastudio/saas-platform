import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/auth";
import { requireModuleEnabled } from "@/lib/modules";

const createSchema = z.object({
  name: z.string().min(1).max(60),
  zone: z.string().max(60).nullable().optional(),
  seats: z.number().int().min(1).max(100).nullable().optional(),
  locationId: z.string().nullable().optional(),
});

// GET /api/tenant/tables
export async function GET() {
  const session = await requirePermission("ORDERS");
  await requireModuleEnabled(session.tenantId, "ORDERS");
  const tables = await db.restaurantTable.findMany({
    where: { tenantId: session.tenantId },
    orderBy: [{ zone: "asc" }, { sortOrder: "asc" }],
  });
  return NextResponse.json({ tables });
}

// POST /api/tenant/tables — el dueño agrega una mesa del salón.
export async function POST(req: NextRequest) {
  const session = await requirePermission("ORDERS");
  await requireModuleEnabled(session.tenantId, "ORDERS");
  const parsed = createSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  if (parsed.data.locationId) {
    const location = await db.location.findFirst({
      where: { id: parsed.data.locationId, tenantId: session.tenantId },
    });
    if (!location) return NextResponse.json({ error: "Ubicación no encontrada" }, { status: 400 });
  }

  const count = await db.restaurantTable.count({ where: { tenantId: session.tenantId } });
  const table = await db.restaurantTable.create({
    data: {
      tenantId: session.tenantId,
      name: parsed.data.name,
      zone: parsed.data.zone || null,
      seats: parsed.data.seats ?? null,
      locationId: parsed.data.locationId || null,
      sortOrder: count,
    },
  });

  return NextResponse.json({ table }, { status: 201 });
}
