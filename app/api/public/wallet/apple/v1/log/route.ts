import { NextRequest, NextResponse } from "next/server";

// POST — Apple manda acá cualquier error que el dispositivo tuvo
// interactuando con el pase. No hace falta guardarlo en la base de
// datos para que el resto del protocolo funcione — con dejarlo en el
// log del servidor alcanza para poder revisarlo si algo falla.
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  if (body?.logs) console.error("Apple Wallet — log del dispositivo:", body.logs);
  return new NextResponse(null, { status: 200 });
}
