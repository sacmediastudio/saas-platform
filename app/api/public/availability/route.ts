import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getAvailableSlots } from "@/lib/availability";

// GET /api/public/availability?slug=X&serviceId=Y&date=YYYY-MM-DD
// Público, sin sesión — lo usa el flujo de reserva del cliente final
// para saber qué horarios ofrecerle una vez que eligió servicio y día.
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const slug = searchParams.get("slug");
  const serviceId = searchParams.get("serviceId");
  const dateParam = searchParams.get("date"); // "YYYY-MM-DD"

  if (!slug || !serviceId || !dateParam) {
    return NextResponse.json({ error: "Faltan parámetros" }, { status: 400 });
  }

  const tenant = await db.tenant.findUnique({ where: { slug }, select: { id: true } });
  if (!tenant) {
    return NextResponse.json({ error: "Negocio no encontrado" }, { status: 404 });
  }

  // Se parsea como fecha local (no UTC), para que "hoy" en el navegador
  // del cliente coincida con el día que de verdad se está consultando.
  const [year, month, day] = dateParam.split("-").map(Number);
  if (!year || !month || !day) {
    return NextResponse.json({ error: "Fecha inválida" }, { status: 400 });
  }
  const date = new Date(year, month - 1, day);

  const slots = await getAvailableSlots({ tenantId: tenant.id, serviceId, date });
  return NextResponse.json({ slots });
}
