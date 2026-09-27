import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requirePermission, requireTenant } from "@/lib/auth";
import { getEnabledModules, type ModuleType } from "@/lib/modules";

// Citas y Smartlink ya no son módulos solicitables: Citas se dejó de
// vender, y Smartlink pasó a ser gratis e incluido para todos — no
// hace falta pedirlo. Restaurant y Orders son los módulos pagos reales.
const schema = z.object({ module: z.enum(["RESTAURANT", "ORDERS"]) });

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
  const session = await requirePermission("MODULES");
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

  // Orders es un complemento operativo de Menu + Eats, no un producto
  // suelto — sin un menú online activo y sin Eats prendido no hay nada
  // que Orders pueda centralizar.
  if (target === "ORDERS") {
    const enabled = getEnabledModules(tenant as any);
    if (!enabled.includes("RESTAURANT") || !tenant.nowEnabled) {
      return NextResponse.json(
        { error: "Para activar Orders primero necesitás tener Menú y Zertoo Eats activos." },
        { status: 400 }
      );
    }
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
