import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/auth";

const createSchema = z.object({
  name: z.string().min(1).max(100),
  address: z.string().max(300).nullable().optional(),
  contactPhone: z.string().max(30).nullable().optional(),
  pickupEnabled: z.boolean().default(true),
  deliveryEnabled: z.boolean().default(false),
  deliveryFee: z.number().min(0).nullable().optional(),
  minDeliveryAmount: z.number().min(0).nullable().optional(),
});

// GET /api/tenant/locations
export async function GET() {
  const session = await requirePermission("ORDERS");
  const locations = await db.location.findMany({
    where: { tenantId: session.tenantId },
    orderBy: { sortOrder: "asc" },
  });
  return NextResponse.json({ locations });
}

// POST /api/tenant/locations — el negocio agrega una sucursal más.
export async function POST(req: NextRequest) {
  const session = await requirePermission("ORDERS");
  const parsed = createSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const count = await db.location.count({ where: { tenantId: session.tenantId } });

  const location = await db.location.create({
    data: {
      tenantId: session.tenantId,
      name: parsed.data.name,
      address: parsed.data.address || null,
      contactPhone: parsed.data.contactPhone || null,
      pickupEnabled: parsed.data.pickupEnabled,
      deliveryEnabled: parsed.data.deliveryEnabled,
      deliveryFee: parsed.data.deliveryFee ?? null,
      minDeliveryAmount: parsed.data.minDeliveryAmount ?? null,
      sortOrder: count,
    },
  });

  return NextResponse.json({ location }, { status: 201 });
}
