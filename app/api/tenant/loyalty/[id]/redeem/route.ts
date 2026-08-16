import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireTenant } from "@/lib/auth";

// POST /api/tenant/loyalty/[id]/redeem — el negocio marca que el
// cliente ya reclamó su premio en persona: resetea los sellos a 0 (le
// deja el sobrante si tenía más de los necesarios, en vez de perderlos)
// y suma uno a su historial de premios canjeados.
export async function POST(_req: Request, { params }: { params: { id: string } }) {
  const session = await requireTenant();

  const card = await db.loyaltyCard.findFirst({ where: { id: params.id, tenantId: session.tenantId } });
  if (!card) return NextResponse.json({ error: "No encontrada" }, { status: 404 });

  const tenant = await db.tenant.findUnique({
    where: { id: session.tenantId },
    select: { loyaltyVisitsNeeded: true },
  });
  const visitsNeeded = tenant?.loyaltyVisitsNeeded ?? 6;

  const updated = await db.loyaltyCard.update({
    where: { id: params.id },
    data: {
      stamps: Math.max(0, card.stamps - visitsNeeded),
      rewardsRedeemed: { increment: 1 },
    },
  });

  return NextResponse.json({ card: updated });
}
