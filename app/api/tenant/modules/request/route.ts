import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireTenant } from "@/lib/auth";
import { getEnabledModules, type ModuleType } from "@/lib/modules";

const schema = z.object({ module: z.enum(["RESTAURANT", "SMALL_BUSINESS", "SMARTLINK"]) });

// GET /api/tenant/modules/request — solicitudes del negocio, para
// saber en el dashboard cuáles ya están pendientes (y no dejar pedir
// el mismo módulo dos veces).
export async function GET() {
  const session = await requireTenant();
  const requests = await db.moduleActivationRequest.findMany({
    where: { tenantId: session.tenantId, status: "pending" },
  });
  return NextResponse.json({ requests });
}

// POST /api/tenant/modules/request — deja una solicitud para que un
// admin de Zertoo la revise y active a mano (ver /api/tenant/modules
// para el porqué de este cambio).
export async function POST(req: NextRequest) {
  const session = await requireTenant();
  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Datos inválidos" }, { status: 400 });
  }
  const target = parsed.data.module as ModuleType;

  const tenant = await db.tenant.findUnique({ where: { id: session.tenantId } });
  if (!tenant) return NextResponse.json({ error: "No encontrado" }, { status: 404 });

  if (getEnabledModules(tenant as any).includes(target)) {
    return NextResponse.json({ error: "Ese módulo ya está activo." }, { status: 400 });
  }

  const existing = await db.moduleActivationRequest.findFirst({
    where: { tenantId: session.tenantId, module: target, status: "pending" },
  });
  if (existing) {
    return NextResponse.json({ request: existing, alreadyPending: true });
  }

  const request = await db.moduleActivationRequest.create({
    data: { tenantId: session.tenantId, module: target },
  });

  return NextResponse.json({ request, alreadyPending: false }, { status: 201 });
}
