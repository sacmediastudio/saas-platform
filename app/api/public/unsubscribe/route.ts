import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

// POST /api/public/unsubscribe — marca al cliente como desuscrito, no
// se le vuelve a incluir en ninguna campaña futura. El customerId viene
// del link que se manda en cada correo de campaña (ver lib/email.ts).
export async function POST(req: NextRequest) {
  const { customerId } = await req.json();
  if (!customerId) return NextResponse.json({ error: "Falta el identificador" }, { status: 400 });

  const customer = await db.customer.findUnique({ where: { id: customerId } });
  if (!customer) return NextResponse.json({ error: "No encontrado" }, { status: 404 });

  await db.customer.update({ where: { id: customerId }, data: { unsubscribed: true } });
  return NextResponse.json({ ok: true });
}
