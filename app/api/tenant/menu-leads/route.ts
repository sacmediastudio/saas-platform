import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/auth";

export async function GET() {
  const session = await requirePermission("MENU_LEADS");

  const [tenant, leads] = await Promise.all([
    db.tenant.findUnique({
      where: { id: session.tenantId },
      select: {
        menuLeadEnabled: true,
        menuLeadButtonLabel: true,
        menuLeadRewardText: true,
        menuLeadDailyLimit: true,
      },
    }),
    db.menuLead.findMany({ where: { tenantId: session.tenantId }, orderBy: { createdAt: "desc" } }),
  ]);

  return NextResponse.json({
    enabled: tenant?.menuLeadEnabled ?? false,
    buttonLabel: tenant?.menuLeadButtonLabel ?? "Postre gratis 🎁",
    rewardText: tenant?.menuLeadRewardText ?? "un postre gratis en tu próxima visita",
    dailyLimit: tenant?.menuLeadDailyLimit ?? 20,
    leads,
  });
}

const schema = z.object({
  enabled: z.boolean(),
  buttonLabel: z.string().min(1).max(60),
  rewardText: z.string().min(1).max(200),
  dailyLimit: z.number().int().min(1).max(1000),
});

export async function PUT(req: NextRequest) {
  const session = await requirePermission("MENU_LEADS");
  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Datos inválidos" }, { status: 400 });
  }

  await db.tenant.update({
    where: { id: session.tenantId },
    data: {
      menuLeadEnabled: parsed.data.enabled,
      menuLeadButtonLabel: parsed.data.buttonLabel,
      menuLeadRewardText: parsed.data.rewardText,
      menuLeadDailyLimit: parsed.data.dailyLimit,
    },
  });

  return NextResponse.json({ ok: true });
}
