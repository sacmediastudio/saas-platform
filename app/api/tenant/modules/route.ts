import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireTenant } from "@/lib/auth";
import { getEnabledModules, type ModuleType } from "@/lib/modules";
import { getStripe, isStripeConfigured, PRICE_ID_BY_MODULE } from "@/lib/stripe";
import { ensureTrialEndsAt, getBillingStatus, canActivateNewModule } from "@/lib/billing-status";

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
  const isNewActivation = parsed.data.enabled && !current.includes(target);

  const subscription = await db.subscription.findUnique({
    where: { tenantId: tenant.id },
    include: { items: true },
  });

  // El bloqueo real: activar un módulo NUEVO (no solo reactivar uno que
  // ya estaba prendido) requiere estar dentro del trial vigente, o
  // tener una suscripción de Stripe activa/al día — nunca gratis fuera
  // de esas dos condiciones.
  if (isNewActivation) {
    const trialEndsAt = await ensureTrialEndsAt(db, tenant);
    const status = getBillingStatus({ trialEndsAt }, subscription);
    if (!canActivateNewModule(status)) {
      return NextResponse.json(
        {
          error:
            status === "past_due"
              ? "Tu suscripción tiene un pago pendiente — resuélvelo antes de activar un módulo nuevo."
              : "Tu período de prueba terminó. Suscríbete para activar módulos nuevos.",
          billingStatus: status,
        },
        { status: 402 }
      );
    }
  }

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

  // Si el negocio ya tiene una suscripción real de Stripe (no solo el
  // trial), sumamos o quitamos ese módulo de lo que se le está
  // cobrando — sin esto, activar un módulo nuevo no se reflejaría en
  // la próxima factura hasta que alguien lo notara a mano.
  if (isStripeConfigured() && subscription?.stripeSubscriptionId) {
    const priceId = PRICE_ID_BY_MODULE[target];
    const stripe = getStripe();

    try {
      if (parsed.data.enabled && priceId) {
        const alreadyBilled = subscription.items.some((i) => i.module === target);
        if (!alreadyBilled) {
          const item = await stripe.subscriptionItems.create({
            subscription: subscription.stripeSubscriptionId,
            price: priceId,
            quantity: 1,
          });
          await db.subscriptionModuleItem.create({
            data: { subscriptionId: subscription.id, module: target, stripeItemId: item.id },
          });
        }
      } else if (!parsed.data.enabled) {
        const existingItem = subscription.items.find((i) => i.module === target);
        if (existingItem?.stripeItemId) {
          await stripe.subscriptionItems.del(existingItem.stripeItemId);
          await db.subscriptionModuleItem.delete({ where: { id: existingItem.id } });
        }
      }
    } catch (err) {
      // No bloqueamos el cambio de módulo por un error de Stripe acá
      // (ya se validó ARRIBA que podía activarlo) — el webhook de
      // customer.subscription.updated también resincroniza esto, así
      // que en el peor caso queda desalineado un momento y se corrige
      // solo.
      console.error("No se pudo sincronizar el módulo con la suscripción de Stripe:", err);
    }
  }

  return NextResponse.json({ enabledModules: getEnabledModules(updated as any) });
}
