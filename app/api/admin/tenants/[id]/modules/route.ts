import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/admin-auth";
import { logAdminActivity } from "@/lib/admin-log";
import { getEnabledModules, MODULE_LABELS, type ModuleType } from "@/lib/modules";
import { getStripe, isStripeConfigured } from "@/lib/stripe";

const schema = z.object({
  module: z.enum(["RESTAURANT", "SMALL_BUSINESS", "SMARTLINK", "ORDERS"]),
});

// DELETE /api/admin/tenants/[id]/modules — el admin desactiva un módulo
// de un negocio. Misma lógica que la baja que hace el propio cliente en
// PATCH /api/tenant/modules: se quita el módulo de enabledModules y, si
// tiene suscripción real de Stripe, se quita ese ítem de lo que se le
// cobra, sin crédito prorrateado (se queda con lo ya pagado del ciclo).
//
// Activar un módulo no se hace acá: eso pasa por la solicitud de
// activación (/admin/module-requests), que además cobra.
export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const admin = await requireAdmin();
  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Datos inválidos" }, { status: 400 });
  }

  const tenant = await db.tenant.findUnique({ where: { id: params.id } });
  if (!tenant) return NextResponse.json({ error: "No encontrado" }, { status: 404 });

  const target = parsed.data.module as ModuleType;
  const current = getEnabledModules(tenant as any);

  if (!current.includes(target)) {
    return NextResponse.json({ error: "Ese módulo ya está desactivado." }, { status: 400 });
  }
  const next = current.filter((m) => m !== target);
  if (next.length === 0) {
    return NextResponse.json({ error: "El negocio necesita al menos un módulo activo." }, { status: 400 });
  }

  // Primero Stripe y después la base: si Stripe falla, el módulo sigue
  // activo y el admin lo ve, en vez de quedar desactivado pero cobrándose.
  let stripeNote = "";
  if (isStripeConfigured()) {
    const subscription = await db.subscription.findUnique({
      where: { tenantId: tenant.id },
      include: { items: true },
    });
    const existingItem = subscription?.items.find((i) => i.module === target);
    if (subscription?.stripeSubscriptionId && existingItem?.stripeItemId) {
      try {
        await getStripe().subscriptionItems.del(existingItem.stripeItemId, { proration_behavior: "none" });
        stripeNote = " · se quitó de la suscripción de Stripe";
      } catch (err) {
        console.error("No se pudo quitar el módulo de la suscripción de Stripe:", err);
        return NextResponse.json(
          { error: "No se pudo quitar el módulo de Stripe — no se desactivó nada. Reintenta o revísalo en Stripe." },
          { status: 502 }
        );
      }
    }
  }

  const updated = await db.tenant.update({ where: { id: tenant.id }, data: { enabledModules: next } });

  await logAdminActivity({
    adminEmail: admin.email,
    action: "DEACTIVATE_MODULE",
    tenantId: tenant.id,
    tenantName: tenant.name,
    details: `módulo: ${MODULE_LABELS[target]}${stripeNote}`,
  });

  return NextResponse.json({ enabledModules: getEnabledModules(updated as any) });
}
