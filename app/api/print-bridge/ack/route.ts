import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requirePrintBridgeAuth } from "@/lib/print-bridge-auth";
import { withAuthErrors } from "@/lib/api-route";

const schema = z.object({
  itemIds: z.array(z.string()).min(1).max(200),
});

// POST /api/print-bridge/ack — el Print Bridge confirma acá qué líneas
// mandó a imprimir de verdad, para que el próximo polling de
// /api/print-bridge/jobs no se las vuelva a mandar.
export async function POST(req: Request) {
  return withAuthErrors(async () => {
    const tenantId = await requirePrintBridgeAuth(req);
    const parsed = schema.safeParse(await req.json());
    if (!parsed.success) return NextResponse.json({ error: "Datos inválidos" }, { status: 400 });

    const result = await db.menuOrderItem.updateMany({
      where: { id: { in: parsed.data.itemIds }, order: { tenantId } },
      data: { printedAt: new Date() },
    });

    return NextResponse.json({ acknowledged: result.count });
  });
}
