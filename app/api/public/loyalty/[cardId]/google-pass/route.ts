import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { upsertLoyaltyObject, buildSaveLink, isGoogleWalletConfigured } from "@/lib/google-wallet";

// GET /api/public/loyalty/[cardId]/google-pass — a diferencia del de
// Apple, este no devuelve un archivo: redirige directo al link de
// Google que abre la pantalla de "Agregar a Google Wallet".
export async function GET(_req: NextRequest, { params }: { params: { cardId: string } }) {
  if (!isGoogleWalletConfigured()) {
    return NextResponse.json({ error: "Google Wallet no está configurado todavía" }, { status: 503 });
  }

  const card = await db.loyaltyCard.findUnique({ where: { id: params.cardId } });
  if (!card) return NextResponse.json({ error: "No encontrada" }, { status: 404 });

  const tenant = await db.tenant.findUnique({
    where: { id: card.tenantId },
    select: {
      id: true,
      name: true,
      logoUrl: true,
      buttonColor: true,
      themeTextColor: true,
      loyaltyEnabled: true,
      loyaltyVisitsNeeded: true,
      loyaltyReward: true,
    },
  });
  if (!tenant || !tenant.loyaltyEnabled) return NextResponse.json({ error: "No disponible" }, { status: 404 });

  const objectId = await upsertLoyaltyObject(
    { id: card.id, customerName: card.customerName, stamps: card.stamps },
    tenant
  );

  return NextResponse.redirect(buildSaveLink(objectId));
}
