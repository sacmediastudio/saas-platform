import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { generateLoyaltyPass, authTokenFor } from "@/lib/apple-wallet";

export async function GET(
  req: NextRequest,
  { params }: { params: { passTypeIdentifier: string; serialNumber: string } }
) {
  const header = req.headers.get("authorization") || "";
  const token = header.replace("ApplePass ", "").trim();
  if (token !== authTokenFor(params.serialNumber)) return new NextResponse(null, { status: 401 });

  const card = await db.loyaltyCard.findUnique({ where: { id: params.serialNumber } });
  if (!card) return new NextResponse(null, { status: 404 });

  const tenant = await db.tenant.findUnique({
    where: { id: card.tenantId },
    select: {
      name: true,
      logoUrl: true,
      buttonColor: true,
      themeTextColor: true,
      loyaltyEnabled: true,
      loyaltyVisitsNeeded: true,
      loyaltyReward: true,
    },
  });
  if (!tenant || !tenant.loyaltyEnabled) return new NextResponse(null, { status: 404 });

  const buffer = await generateLoyaltyPass(
    { id: card.id, customerName: card.customerName, stamps: card.stamps },
    tenant
  );

  return new NextResponse(buffer as any, {
    headers: {
      "Content-Type": "application/vnd.apple.pkpass",
      "Last-Modified": card.updatedAt.toUTCString(),
    },
  });
}
