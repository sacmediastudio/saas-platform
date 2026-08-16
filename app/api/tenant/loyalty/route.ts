import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireTenant } from "@/lib/auth";

export async function GET() {
  const session = await requireTenant();

  const [tenant, cards] = await Promise.all([
    db.tenant.findUnique({
      where: { id: session.tenantId },
      select: { loyaltyEnabled: true, loyaltyVisitsNeeded: true, loyaltyReward: true },
    }),
    db.loyaltyCard.findMany({
      where: { tenantId: session.tenantId },
      orderBy: { stamps: "desc" },
    }),
  ]);

  return NextResponse.json({
    enabled: tenant?.loyaltyEnabled ?? false,
    visitsNeeded: tenant?.loyaltyVisitsNeeded ?? 6,
    reward: tenant?.loyaltyReward ?? "Tu próxima visita es gratis",
    cards,
  });
}

const schema = z.object({
  enabled: z.boolean(),
  visitsNeeded: z.number().int().min(2).max(50),
  reward: z.string().min(1).max(200),
});

export async function PUT(req: NextRequest) {
  const session = await requireTenant();
  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Datos inválidos" }, { status: 400 });
  }

  await db.tenant.update({
    where: { id: session.tenantId },
    data: {
      loyaltyEnabled: parsed.data.enabled,
      loyaltyVisitsNeeded: parsed.data.visitsNeeded,
      loyaltyReward: parsed.data.reward,
    },
  });

  return NextResponse.json({ ok: true });
}
