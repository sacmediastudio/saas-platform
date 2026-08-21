import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/admin-auth";
import { getEnabledModules, MODULE_LABELS, MODULE_PRICES, type ModuleType } from "@/lib/modules";
import { getStripe, isStripeConfigured, PRICE_ID_BY_MODULE } from "@/lib/stripe";

// POST /api/admin/module-requests/[id]/approve — activa el módulo de
// verdad para ese negocio.
//
// Si el negocio YA tiene una suscripción real de Stripe, el cobro pasa
// primero: se genera y se intenta pagar una factura inmediata por el
// módulo, en el momento — no basta con sumarlo a la suscripción y
// esperar al próximo ciclo (eso es lo que hacía Stripe por defecto, y
// dejaba al negocio usando el módulo gratis hasta la próxima factura,
// que puede ser semanas después). El módulo solo se activa de verdad
// si ese cobro se confirma; si falla, no se activa nada y la
// solicitud queda marcada para que el admin le dé seguimiento.
//
// Si el negocio todavía está en trial (sin suscripción de Stripe
// todavía), se activa gratis como antes — es esperable durante el
// trial, y se factura normal el día que pase por checkout por primera vez.
export async function POST(_req: Request, { params }: { params: { id: string } }) {
  await requireAdmin();

  const request = await db.moduleActivationRequest.findUnique({ where: { id: params.id } });
  if (!request) return NextResponse.json({ error: "No encontrada" }, { status: 404 });
  if (request.status !== "pending") {
    return NextResponse.json({ error: "Esta solicitud ya fue resuelta." }, { status: 400 });
  }

  const tenant = await db.tenant.findUnique({ where: { id: request.tenantId } });
  if (!tenant) return NextResponse.json({ error: "Negocio no encontrado" }, { status: 404 });

  const target = request.module as ModuleType;
  const current = getEnabledModules(tenant as any);

  const subscription = await db.subscription.findUnique({
    where: { tenantId: tenant.id },
    include: { items: true },
  });

  // Si ya paga de verdad, el cobro inmediato pasa ANTES de activar nada.
  if (isStripeConfigured() && subscription?.stripeSubscriptionId && subscription.stripeCustomerId) {
    const priceId = PRICE_ID_BY_MODULE[target];
    const alreadyBilled = subscription.items.some((i) => i.module === target);

    if (priceId && !alreadyBilled) {
      const stripe = getStripe();
      let subscriptionItemId: string | null = null;

      try {
        // Se agrega SIN proración automática — el cobro real de este
        // momento lo maneja la factura de una sola vez de abajo, no
        // Stripe solo con la próxima renovación.
        const item = await stripe.subscriptionItems.create({
          subscription: subscription.stripeSubscriptionId,
          price: priceId,
          quantity: 1,
          proration_behavior: "none",
        });
        subscriptionItemId = item.id;

        await stripe.invoiceItems.create({
          customer: subscription.stripeCustomerId,
          amount: Math.round(MODULE_PRICES[target] * 100),
          currency: "usd",
          description: `Activación de módulo: ${MODULE_LABELS[target]}`,
        });

        const invoice = await stripe.invoices.create({
          customer: subscription.stripeCustomerId,
          collection_method: "charge_automatically",
        });
        // finalizeInvoice() con collection_method:"charge_automatically"
        // YA intenta cobrar como parte de la finalización — no hace
        // falta (ni se puede) llamar a .pay() después, sobre una
        // factura que puede haber quedado pagada en este mismo paso.
        const finalized = await stripe.invoices.finalizeInvoice(invoice.id!);

        if (finalized.status !== "paid") {
          // El cobro no se confirmó — se revierte el ítem de la
          // suscripción para no dejar algo "medio activado" cobrando
          // sin haber cobrado, y se marca la solicitud para seguimiento.
          await stripe.subscriptionItems.del(subscriptionItemId, { proration_behavior: "none" });
          await db.moduleActivationRequest.update({
            where: { id: request.id },
            data: { status: "payment_failed", resolvedAt: new Date() },
          });
          return NextResponse.json(
            { error: "El cobro inmediato no se pudo confirmar — el módulo no se activó." },
            { status: 402 }
          );
        }

        await db.subscriptionModuleItem.create({
          data: { subscriptionId: subscription.id, module: target, stripeItemId: subscriptionItemId },
        });
      } catch (err) {
        console.error("No se pudo cobrar/activar el módulo:", err);
        if (subscriptionItemId) {
          await stripe.subscriptionItems.del(subscriptionItemId, { proration_behavior: "none" }).catch(() => {});
        }
        await db.moduleActivationRequest.update({
          where: { id: request.id },
          data: { status: "payment_failed", resolvedAt: new Date() },
        });
        return NextResponse.json({ error: "No se pudo procesar el cobro — el módulo no se activó." }, { status: 502 });
      }
    }
  }

  // El cobro (si correspondía) ya se confirmó — recién ahora se activa de verdad.
  const next = current.includes(target) ? current : [...current, target];

  if (target === "RESTAURANT" && !current.includes("RESTAURANT")) {
    const existingCategory = await db.menuCategory.findFirst({ where: { tenantId: tenant.id } });
    if (!existingCategory) {
      await db.menuCategory.create({ data: { tenantId: tenant.id, name: "Platos principales" } });
    }
  }

  await db.tenant.update({ where: { id: tenant.id }, data: { enabledModules: next } });

  const updatedRequest = await db.moduleActivationRequest.update({
    where: { id: request.id },
    data: { status: "approved", resolvedAt: new Date() },
  });

  return NextResponse.json({ request: updatedRequest });
}
