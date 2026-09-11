import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { authTokenFor } from "@/lib/apple-wallet";

// Confirma que quien llama realmente tiene este pase — Apple manda el
// token que puso authenticationToken en pass.json, en el header
// Authorization con el prefijo "ApplePass ".
function isAuthorized(req: NextRequest, serialNumber: string): boolean {
  const header = req.headers.get("authorization") || "";
  const token = header.replace("ApplePass ", "").trim();
  return token === authTokenFor(serialNumber);
}

// POST — el dispositivo se registra para recibir avisos cuando este
// pase puntual cambie. Apple manda el pushToken en el body.
export async function POST(
  req: NextRequest,
  { params }: { params: { deviceLibraryIdentifier: string; passTypeIdentifier: string; serialNumber: string } }
) {
  if (!isAuthorized(req, params.serialNumber)) return new NextResponse(null, { status: 401 });

  const card = await db.loyaltyCard.findUnique({ where: { id: params.serialNumber } });
  if (!card) return new NextResponse(null, { status: 404 });

  const body = await req.json().catch(() => null);
  if (!body?.pushToken) return new NextResponse(null, { status: 400 });

  await db.walletDeviceRegistration.upsert({
    where: {
      deviceLibraryIdentifier_loyaltyCardId: {
        deviceLibraryIdentifier: params.deviceLibraryIdentifier,
        loyaltyCardId: params.serialNumber,
      },
    },
    update: { pushToken: body.pushToken },
    create: {
      deviceLibraryIdentifier: params.deviceLibraryIdentifier,
      loyaltyCardId: params.serialNumber,
      pushToken: body.pushToken,
    },
  });

  return new NextResponse(null, { status: 201 });
}

// DELETE — el dispositivo se da de baja (el cliente borró el pase de
// su Wallet).
export async function DELETE(
  req: NextRequest,
  { params }: { params: { deviceLibraryIdentifier: string; passTypeIdentifier: string; serialNumber: string } }
) {
  if (!isAuthorized(req, params.serialNumber)) return new NextResponse(null, { status: 401 });

  await db.walletDeviceRegistration
    .delete({
      where: {
        deviceLibraryIdentifier_loyaltyCardId: {
          deviceLibraryIdentifier: params.deviceLibraryIdentifier,
          loyaltyCardId: params.serialNumber,
        },
      },
    })
    .catch(() => {}); // si ya no existía el registro, no es un error real

  return new NextResponse(null, { status: 200 });
}
