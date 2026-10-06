import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/auth";
import { requireModuleEnabled } from "@/lib/modules";

const updateSchema = z.object({
  name: z.string().min(1).max(60).optional(),
  ipAddress: z.string().min(1).max(45).optional(),
  port: z.number().int().min(1).max(65535).optional(),
  stationId: z.string().nullable().optional(),
  printsReceipts: z.boolean().optional(),
});

async function findOwnedPrinter(tenantId: string, id: string) {
  return db.printer.findFirst({ where: { id, tenantId } });
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await requirePermission("ORDERS");
  await requireModuleEnabled(session.tenantId, "ORDERS");
  const existing = await findOwnedPrinter(session.tenantId, params.id);
  if (!existing) return NextResponse.json({ error: "Impresora no encontrada" }, { status: 404 });

  const parsed = updateSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  if (parsed.data.stationId) {
    const station = await db.preparationStation.findFirst({
      where: { id: parsed.data.stationId, tenantId: session.tenantId },
    });
    if (!station) return NextResponse.json({ error: "Estación no encontrada" }, { status: 400 });
  }

  const printer = await db.printer.update({
    where: { id: params.id },
    data: {
      ...parsed.data,
      stationId: parsed.data.stationId === undefined ? undefined : parsed.data.stationId || null,
    },
    include: { station: { select: { id: true, name: true } } },
  });
  return NextResponse.json({ printer });
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await requirePermission("ORDERS");
  await requireModuleEnabled(session.tenantId, "ORDERS");
  const existing = await findOwnedPrinter(session.tenantId, params.id);
  if (!existing) return NextResponse.json({ error: "Impresora no encontrada" }, { status: 404 });

  await db.printer.delete({ where: { id: params.id } });
  return NextResponse.json({ ok: true });
}
