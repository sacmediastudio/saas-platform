import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireTenant } from "@/lib/auth";
import { getEnabledModules, type ModuleType } from "@/lib/modules";

const schema = z.object({
  module: z.enum(["RESTAURANT", "SMALL_BUSINESS", "SMARTLINK"]),
  enabled: z.boolean(),
});

// PATCH /api/tenant/modules — activa o desactiva un módulo para el
// negocio de la sesión. Desactivar NO borra los datos de ese módulo
// (platos, citas, links siguen ahí) — solo deja de aparecer en el nav
// y bloquea el acceso al dashboard y a la página pública, por si lo
// quieren reactivar más adelante.
export async function PATCH(req: NextRequest) {
  const session = await requireTenant();
  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Datos inválidos" }, { status: 400 });
  }

  const tenant = await db.tenant.findUnique({ where: { id: session.tenantId } });
  if (!tenant) return NextResponse.json({ error: "No encontrado" }, { status: 404 });

  const current = getEnabledModules(tenant as any);
  const target = parsed.data.module as ModuleType;

  let next: ModuleType[];
  if (parsed.data.enabled) {
    next = current.includes(target) ? current : [...current, target];
  } else {
    next = current.filter((m) => m !== target);
    if (next.length === 0) {
      return NextResponse.json(
        { error: "Necesitas al menos un módulo activo." },
        { status: 400 }
      );
    }
  }

  // Si es la primera vez que se activa el módulo de Menú, le damos una
  // categoría inicial — igual que hacemos en el signup — para que el
  // dashboard no arranque completamente vacío.
  if (parsed.data.enabled && target === "RESTAURANT" && !current.includes("RESTAURANT")) {
    const existingCategory = await db.menuCategory.findFirst({ where: { tenantId: tenant.id } });
    if (!existingCategory) {
      await db.menuCategory.create({ data: { tenantId: tenant.id, name: "Platos principales" } });
    }
  }

  const updated = await db.tenant.update({
    where: { id: tenant.id },
    data: { enabledModules: next },
  });

  return NextResponse.json({ enabledModules: getEnabledModules(updated as any) });
}
