import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

// GET — Apple le pregunta a este endpoint (sin autenticación propia,
// es información pública de qué cambió, no del contenido en sí) qué
// pases de este dispositivo tienen una versión más nueva que
// "passesUpdatedSince". Devuelve los serialNumbers (=id de la
// tarjeta) que cambiaron, más una "tag" para la próxima consulta.
export async function GET(
  req: NextRequest,
  { params }: { params: { deviceLibraryIdentifier: string; passTypeIdentifier: string } }
) {
  const updatedSince = req.nextUrl.searchParams.get("passesUpdatedSince");
  const since = updatedSince ? new Date(Number(updatedSince) * 1000) : new Date(0);

  const registrations = await db.walletDeviceRegistration.findMany({
    where: { deviceLibraryIdentifier: params.deviceLibraryIdentifier },
    include: { loyaltyCard: { select: { id: true, updatedAt: true } } },
  });

  const changed = registrations.filter((r) => r.loyaltyCard.updatedAt > since).map((r) => r.loyaltyCard.id);

  if (changed.length === 0) return new NextResponse(null, { status: 204 });

  return NextResponse.json({
    serialNumbers: changed,
    lastUpdated: String(Math.floor(Date.now() / 1000)),
  });
}
