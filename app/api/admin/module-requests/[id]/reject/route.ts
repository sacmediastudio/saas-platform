import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/admin-auth";

// POST /api/admin/module-requests/[id]/reject — no activa nada, solo
// marca la solicitud como resuelta (para cuando el admin decide no
// activarlo, ej. porque prefiere primero hablar con el negocio).
export async function POST(_req: Request, { params }: { params: { id: string } }) {
  await requireAdmin();

  const request = await db.moduleActivationRequest.findUnique({ where: { id: params.id } });
  if (!request) return NextResponse.json({ error: "No encontrada" }, { status: 404 });
  if (request.status !== "pending") {
    return NextResponse.json({ error: "Esta solicitud ya fue resuelta." }, { status: 400 });
  }

  const updated = await db.moduleActivationRequest.update({
    where: { id: request.id },
    data: { status: "rejected", resolvedAt: new Date() },
  });

  return NextResponse.json({ request: updated });
}
