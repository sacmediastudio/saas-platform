import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireTenant } from "@/lib/auth";

// POST /api/tenant/menu-leads/[id]/redeem — el negocio confirma que
// el cliente presentó su código y le entregó el premio.
export async function POST(_req: Request, { params }: { params: { id: string } }) {
  const session = await requireTenant();

  const lead = await db.menuLead.findFirst({ where: { id: params.id, tenantId: session.tenantId } });
  if (!lead) return NextResponse.json({ error: "No encontrado" }, { status: 404 });

  const updated = await db.menuLead.update({ where: { id: params.id }, data: { redeemedAt: new Date() } });
  return NextResponse.json({ lead: updated });
}
