import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireTenant } from "@/lib/auth";
import { getEnabledModules, type ModuleType } from "@/lib/modules";
import { getStripe, isStripeConfigured, PRICE_ID_BY_MODULE } from "@/lib/stripe";

const schema = z.object({
  module: z.enum(["RESTAURANT", "SMALL_BUSINESS", "SMARTLINK"]),
  enabled: z.boolean(),
});

// PATCH /api/tenant/modules — SOLO desactiva un módulo (o confirma un
// no-op si ya estaba activo). Activar un módulo nuevo ya NO es
// self-service — eso ahora pasa por /api/tenant/modules/request, y lo
// aprueba un admin a mano desde /admin/module-requests. Ver README
// para el porqué de este cambio (evitar altas impulsivas que después
// complican una baja parcial y arriesgan perder al cliente entero).
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

  if (parsed.data.enabled && !current.includes(target)) {
    return NextResponse.json(
      {
        error: "Activar un módulo nuevo requiere una solicitud — usa el botón 'Solicitar activación'.",
      },
      { status: 403 }
    );
  }

  let next: ModuleType[];
  if (parsed.data.enabled) {
    next = current; // ya estaba activo, no-op
  } else {
    next = current.filter((m) => m !== target);
    if (next.length === 0) {
      return NextResponse.json(
        { error: "Necesitas al menos un módulo activo." },
        { status: 400 }
      );
    }
  }

  const updated = await db.tenant.update({
    where: { id: tenant.id },
    data: { enabledModules: next },
  });

  // Al desactivar, si el negocio tiene una suscripción real de Stripe,
  // se le quita ese módulo de lo que se le está cobrando.
  if (!parsed.data.enabled && isStripeConfigured()) {
    const subscription = await db.subscription.findUnique({
      where: { tenantId: tenant.id },
      include: { items: true },
    });

    if (subscription?.stripeSubscriptionId) {
      const stripe = getStripe();
      try {
        const existingItem = subscription.items.find((i) => i.module === target);
        if (existingItem?.stripeItemId) {
          // Sin crédito prorrateado a propósito — el cliente ya pagó
          // el ciclo completo, se queda con lo que ya pagó hasta que
          // termine, y recién el próximo ciclo se le cobra el monto
          // nuevo (más bajo). Simple y fácil de explicar.
          await stripe.subscriptionItems.del(existingItem.stripeItemId, { proration_behavior: "none" });
          // No se borra SubscriptionModuleItem acá a propósito — el
          // .del() de arriba dispara el webhook
          // customer.subscription.updated, que reconstruye esta tabla
          // completa desde el estado real de Stripe (ver
          // app/api/webhooks/stripe/route.ts). Borrarla acá también
          // generaba la misma condición de carrera que en la
          // aprobación de módulos nuevos.
        }
      } catch (err) {
        console.error("No se pudo sincronizar la baja del módulo con Stripe:", err);
      }
    }
  }

  return NextResponse.json({ enabledModules: getEnabledModules(updated as any) });
}
