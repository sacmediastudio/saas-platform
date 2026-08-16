import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireTenant } from "@/lib/auth";

export async function GET() {
  const session = await requireTenant();
  const tenant = await db.tenant.findUnique({
    where: { id: session.tenantId },
    select: {
      orderingEnabled: true,
      pickupEnabled: true,
      deliveryEnabled: true,
      deliveryFee: true,
      minDeliveryAmount: true,
    },
  });
  return NextResponse.json({
    orderingEnabled: tenant?.orderingEnabled ?? false,
    pickupEnabled: tenant?.pickupEnabled ?? true,
    deliveryEnabled: tenant?.deliveryEnabled ?? false,
    deliveryFee: tenant?.deliveryFee ?? null,
    minDeliveryAmount: tenant?.minDeliveryAmount ?? null,
  });
}

const schema = z.object({
  orderingEnabled: z.boolean(),
  pickupEnabled: z.boolean(),
  deliveryEnabled: z.boolean(),
  deliveryFee: z.number().min(0).max(10000).nullable(),
  minDeliveryAmount: z.number().min(0).max(10000).nullable(),
});

export async function PUT(req: NextRequest) {
  const session = await requireTenant();
  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Datos inválidos" }, { status: 400 });
  }

  await db.tenant.update({ where: { id: session.tenantId }, data: parsed.data });
  return NextResponse.json({ ok: true });
}
