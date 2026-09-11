import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { generateLoyaltyPass, isApplePassConfigured } from "@/lib/apple-wallet";

// GET /api/public/loyalty/[cardId]/apple-pass — genera y entrega el
// .pkpass de esta tarjeta puntual. Se llama desde el botón "Agregar a
// Apple Wallet" en las 2 pantallas públicas de sellos.
export async function GET(_req: NextRequest, { params }: { params: { cardId: string } }) {
  if (!isApplePassConfigured()) {
    return NextResponse.json({ error: "Apple Wallet no está configurado todavía" }, { status: 503 });
  }

  const card = await db.loyaltyCard.findUnique({ where: { id: params.cardId } });
  if (!card) return NextResponse.json({ error: "No encontrada" }, { status: 404 });

  const tenant = await db.tenant.findUnique({
    where: { id: card.tenantId },
    select: {
      name: true,
      logoUrl: true,
      walletLogoUrl: true,
      buttonColor: true,
      themeTextColor: true,
      loyaltyEnabled: true,
      loyaltyVisitsNeeded: true,
      loyaltyReward: true,
    },
  });
  if (!tenant || !tenant.loyaltyEnabled) return NextResponse.json({ error: "No disponible" }, { status: 404 });

  const buffer = await generateLoyaltyPass(
    { id: card.id, customerName: card.customerName, stamps: card.stamps },
    tenant
  );

  return new NextResponse(buffer as any, {
    headers: {
      "Content-Type": "application/vnd.apple.pkpass",
      "Content-Disposition": `attachment; filename="${tenant.name.replace(/[^a-zA-Z0-9]/g, "")}.pkpass"`,
    },
  });
}
