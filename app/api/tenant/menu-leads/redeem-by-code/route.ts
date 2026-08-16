import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireTenant } from "@/lib/auth";

const schema = z.object({ code: z.string().min(1) });

// POST /api/tenant/menu-leads/redeem-by-code — el negocio escribe el
// código que el cliente le muestra en su WhatsApp, y lo canjea directo,
// sin tener que buscarlo en la lista.
export async function POST(req: NextRequest) {
  const session = await requireTenant();
  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: "Código inválido" }, { status: 400 });

  const code = parsed.data.code.trim().toUpperCase();
  const lead = await db.menuLead.findFirst({ where: { tenantId: session.tenantId, claimCode: code } });
  if (!lead) return NextResponse.json({ error: "Ese código no existe" }, { status: 404 });
  if (lead.redeemedAt) {
    return NextResponse.json({ error: `Ese código ya fue canjeado (${lead.name})` }, { status: 409 });
  }

  const updated = await db.menuLead.update({ where: { id: lead.id }, data: { redeemedAt: new Date() } });
  return NextResponse.json({ lead: updated });
}
