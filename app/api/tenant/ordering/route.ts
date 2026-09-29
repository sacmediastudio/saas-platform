import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/auth";
import { getEnabledModules } from "@/lib/modules";

export async function GET() {
  const session = await requirePermission("ORDERS");
  const tenant = await db.tenant.findUnique({
    where: { id: session.tenantId },
    select: {
      orderingEnabled: true,
      pickupEnabled: true,
      deliveryEnabled: true,
      deliveryFee: true,
      minDeliveryAmount: true,
      ordersAutoAccept: true,
      ordersAutoPrint: true,
    },
  });
  return NextResponse.json({
    orderingEnabled: tenant?.orderingEnabled ?? false,
    pickupEnabled: tenant?.pickupEnabled ?? true,
    deliveryEnabled: tenant?.deliveryEnabled ?? false,
    deliveryFee: tenant?.deliveryFee ?? null,
    minDeliveryAmount: tenant?.minDeliveryAmount ?? null,
    ordersAutoAccept: tenant?.ordersAutoAccept ?? false,
    ordersAutoPrint: tenant?.ordersAutoPrint ?? false,
  });
}

const schema = z.object({
  orderingEnabled: z.boolean(),
  pickupEnabled: z.boolean(),
  deliveryEnabled: z.boolean(),
  deliveryFee: z.number().min(0).max(10000).nullable(),
  minDeliveryAmount: z.number().min(0).max(10000).nullable(),
  ordersAutoAccept: z.boolean(),
  ordersAutoPrint: z.boolean(),
});

export async function PUT(req: NextRequest) {
  const session = await requirePermission("ORDERS");
  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Datos inválidos" }, { status: 400 });
  }

  // Auto Accept/Print son parte del módulo pago Orders — no tiene
  // sentido dejar guardar "true" para un negocio que no lo tiene
  // activo, aunque el efecto ya esté igual re-chequeado del lado del
  // que consume el flag (ver POST /api/public/menu-orders).
  const tenant = await db.tenant.findUnique({
    where: { id: session.tenantId },
    select: { businessType: true, enabledModules: true },
  });
  const ordersEnabled = tenant ? getEnabledModules(tenant).includes("ORDERS") : false;
  if (!ordersEnabled) {
    parsed.data.ordersAutoAccept = false;
    parsed.data.ordersAutoPrint = false;
  }

  await db.tenant.update({ where: { id: session.tenantId }, data: parsed.data });
  return NextResponse.json({ ok: true });
}
