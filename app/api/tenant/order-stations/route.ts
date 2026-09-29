import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/auth";
import { requireModuleEnabled } from "@/lib/modules";

const createSchema = z.object({
  name: z.string().min(1).max(60),
});

// GET /api/tenant/order-stations
export async function GET() {
  const session = await requirePermission("ORDERS");
  await requireModuleEnabled(session.tenantId, "ORDERS");
  const stations = await db.preparationStation.findMany({
    where: { tenantId: session.tenantId },
    orderBy: { name: "asc" },
  });
  return NextResponse.json({ stations });
}

// POST /api/tenant/order-stations — crea una estación de cocina/barra/caja.
export async function POST(req: NextRequest) {
  const session = await requirePermission("ORDERS");
  await requireModuleEnabled(session.tenantId, "ORDERS");
  const parsed = createSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const station = await db.preparationStation.create({
    data: { tenantId: session.tenantId, name: parsed.data.name },
  });

  return NextResponse.json({ station }, { status: 201 });
}
