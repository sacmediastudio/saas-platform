import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/auth";
import { requireModuleEnabled } from "@/lib/modules";

const createSchema = z.object({
  name: z.string().min(1).max(60),
  ipAddress: z.string().min(1).max(45),
  port: z.number().int().min(1).max(65535).default(9100),
  stationId: z.string().nullable().optional(),
  printsReceipts: z.boolean().optional(),
});

// GET /api/tenant/order-printers
export async function GET() {
  const session = await requirePermission("ORDERS");
  await requireModuleEnabled(session.tenantId, "ORDERS");
  const printers = await db.printer.findMany({
    where: { tenantId: session.tenantId },
    include: { station: { select: { id: true, name: true } } },
    orderBy: { name: "asc" },
  });
  return NextResponse.json({ printers });
}

// POST /api/tenant/order-printers — registra una impresora térmica de red.
export async function POST(req: NextRequest) {
  const session = await requirePermission("ORDERS");
  await requireModuleEnabled(session.tenantId, "ORDERS");
  const parsed = createSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  if (parsed.data.stationId) {
    const station = await db.preparationStation.findFirst({
      where: { id: parsed.data.stationId, tenantId: session.tenantId },
    });
    if (!station) return NextResponse.json({ error: "Estación no encontrada" }, { status: 400 });
  }

  const printer = await db.printer.create({
    data: {
      tenantId: session.tenantId,
      name: parsed.data.name,
      ipAddress: parsed.data.ipAddress,
      port: parsed.data.port,
      stationId: parsed.data.stationId || null,
      printsReceipts: parsed.data.printsReceipts ?? false,
    },
    include: { station: { select: { id: true, name: true } } },
  });

  return NextResponse.json({ printer }, { status: 201 });
}
