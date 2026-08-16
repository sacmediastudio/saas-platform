import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

// GET /api/public/loyalty?slug=X&email=Y — el cliente consulta sus
// propios sellos, sin necesidad de cuenta ni contraseña. Solo devuelve
// el conteo, nada más del negocio.
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const slug = searchParams.get("slug");
  const email = searchParams.get("email");
  if (!slug || !email) return NextResponse.json({ error: "Faltan datos" }, { status: 400 });

  const tenant = await db.tenant.findUnique({
    where: { slug },
    select: { id: true, name: true, loyaltyEnabled: true, loyaltyVisitsNeeded: true, loyaltyReward: true },
  });
  if (!tenant || !tenant.loyaltyEnabled) {
    return NextResponse.json({ error: "No disponible" }, { status: 404 });
  }

  const card = await db.loyaltyCard.findUnique({
    where: { tenantId_customerEmail: { tenantId: tenant.id, customerEmail: email.toLowerCase().trim() } },
    select: { stamps: true },
  });

  return NextResponse.json({
    businessName: tenant.name,
    stamps: card?.stamps ?? 0,
    visitsNeeded: tenant.loyaltyVisitsNeeded,
    reward: tenant.loyaltyReward,
  });
}
