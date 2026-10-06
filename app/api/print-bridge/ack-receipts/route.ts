import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requirePrintBridgeAuth } from "@/lib/print-bridge-auth";
import { withAuthErrors } from "@/lib/api-route";

const schema = z.object({ orderIds: z.array(z.string()).min(1).max(50) });

// POST /api/print-bridge/ack-receipts — el Print Bridge confirma qué
// recibos salieron impresos, para que el próximo polling no los repita.
export async function POST(req: Request) {
  return withAuthErrors(async () => {
    const tenantId = await requirePrintBridgeAuth(req);
    const parsed = schema.safeParse(await req.json());
    if (!parsed.success) return NextResponse.json({ error: "Datos inválidos" }, { status: 400 });

    const result = await db.menuOrder.updateMany({
      where: { id: { in: parsed.data.orderIds }, tenantId },
      data: { receiptPrintPending: false },
    });
    return NextResponse.json({ acknowledged: result.count });
  });
}
