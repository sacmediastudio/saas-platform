import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireTenant } from "@/lib/auth";
import { isWhatsAppConfigured } from "@/lib/whatsapp";

export async function GET() {
  const session = await requireTenant();
  const tenant = await db.tenant.findUnique({
    where: { id: session.tenantId },
    select: { remindersEnabled: true, reminderHoursBefore: true },
  });
  return NextResponse.json({
    configured: isWhatsAppConfigured(),
    remindersEnabled: tenant?.remindersEnabled ?? true,
    reminderHoursBefore: tenant?.reminderHoursBefore ?? 24,
  });
}

const schema = z.object({
  remindersEnabled: z.boolean(),
  reminderHoursBefore: z.number().int().min(1).max(72),
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
