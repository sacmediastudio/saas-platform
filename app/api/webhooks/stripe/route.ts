import { NextRequest, NextResponse } from "next/server";
import type Stripe from "stripe";
import { db } from "@/lib/db";
import { getStripe, mapStripeStatus, moduleForPriceId } from "@/lib/stripe";

const WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET;

// Desde la versión "Basil" de la API de Stripe (marzo 2025),
// current_period_end ya NO vive en la suscripción — se movió a cada
// ítem de la suscripción (para soportar módulos con distinto ciclo de
// facturación cada uno). Los webhooks nos llegan con la versión de API
// configurada en la cuenta de Stripe (no con la que fijamos nosotros
// al llamar a la API), así que hay que leerlo del lugar nuevo primero.
// Todos nuestros módulos comparten el mismo ciclo mensual, así que
// tomar el del primer ítem es seguro para nuestro caso.
function getCurrentPeriodEndSeconds(subscription: Stripe.Subscription): number | null {
  // "as any" a propósito: el paquete "stripe" instalado trae
  // definiciones de tipos de una versión de la API anterior a este
  // cambio — el campo SÍ viene en la respuesta real (la cuenta usa una
  // versión de API más nueva), pero TypeScript todavía no lo conoce en
  // el tipo SubscriptionItem. Mismo criterio que con exceljs/Buffer.
  const fromItem = (subscription.items?.data?.[0] as any)?.current_period_end;
  if (typeof fromItem === "number") return fromItem;
  const legacy = (subscription as unknown as { current_period_end?: number }).current_period_end;
  if (typeof legacy === "number") return legacy;
  return null;
}

// Sincroniza nuestra tabla Subscription (y sus SubscriptionModuleItem)
// con el estado real de una suscripción de Stripe — se llama tanto en
// checkout.session.completed (primera vez) como en
// customer.subscription.updated (cualquier cambio después: se cae un
// pago, cambia de tarjeta, se agrega/quita un módulo, etc).
async function syncSubscriptionFromStripe(stripeSubscription: Stripe.Subscription) {
  const tenantId = stripeSubscription.metadata?.tenantId;
  if (!tenantId) {
    console.error("Webhook de Stripe sin tenantId en metadata, se ignora:", stripeSubscription.id);
    return;
  }

  const periodEndSeconds = getCurrentPeriodEndSeconds(stripeSubscription);
  const currentPeriodEnd = periodEndSeconds !== null ? new Date(periodEndSeconds * 1000) : null;

  const subscription = await db.subscription.upsert({
    where: { tenantId },
    update: {
      stripeCustomerId: stripeSubscription.customer as string,
      stripeSubscriptionId: stripeSubscription.id,
      status: mapStripeStatus(stripeSubscription.status),
      currentPeriodEnd,
    },
    create: {
      tenantId,
      stripeCustomerId: stripeSubscription.customer as string,
      stripeSubscriptionId: stripeSubscription.id,
      status: mapStripeStatus(stripeSubscription.status),
      currentPeriodEnd,
    },
  });

  // Reconstruye los ítems (qué módulos se están cobrando) para que
  // coincidan exactamente con lo que Stripe dice ahora mismo.
  const currentModules = stripeSubscription.items.data
    .map((item) => ({ item, module: moduleForPriceId(item.price.id) }))
    .filter((x): x is { item: Stripe.SubscriptionItem; module: NonNullable<ReturnType<typeof moduleForPriceId>> } =>
      Boolean(x.module)
    );

  await db.$transaction([
    db.subscriptionModuleItem.deleteMany({ where: { subscriptionId: subscription.id } }),
    ...currentModules.map(({ item, module }) =>
      db.subscriptionModuleItem.create({
        data: { subscriptionId: subscription.id, module, stripeItemId: item.id },
      })
    ),
  ]);
}

export async function POST(req: NextRequest) {
  if (!WEBHOOK_SECRET) {
    console.error("STRIPE_WEBHOOK_SECRET no configurado — se ignora el webhook.");
    return NextResponse.json({ error: "No configurado" }, { status: 503 });
  }

  const signature = req.headers.get("stripe-signature");
  if (!signature) {
    return NextResponse.json({ error: "Falta la firma" }, { status: 400 });
  }

  // Importante: hay que leer el cuerpo crudo (sin parsear a JSON) para
  // que la verificación de firma de Stripe funcione — si Next.js ya lo
  // parseó, la firma no va a coincidir.
  const rawBody = await req.text();

  let event: Stripe.Event;
  try {
    event = getStripe().webhooks.constructEvent(rawBody, signature, WEBHOOK_SECRET);
  } catch (err) {
    console.error("Firma de webhook de Stripe inválida:", err);
    return NextResponse.json({ error: "Firma inválida" }, { status: 400 });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        if (session.mode === "subscription" && session.subscription) {
          const stripeSubscription = await getStripe().subscriptions.retrieve(session.subscription as string);
          await syncSubscriptionFromStripe(stripeSubscription);
        }
        break;
      }
      case "customer.subscription.updated":
      case "customer.subscription.created": {
        await syncSubscriptionFromStripe(event.data.object as Stripe.Subscription);
        break;
      }
      case "customer.subscription.deleted": {
        const stripeSubscription = event.data.object as Stripe.Subscription;
        const tenantId = stripeSubscription.metadata?.tenantId;
        if (tenantId) {
          await db.subscription.updateMany({ where: { tenantId }, data: { status: "canceled" } });
        }
        break;
      }
      case "invoice.payment_failed": {
        const invoice = event.data.object as Stripe.Invoice;
        const customerId = invoice.customer as string;
        await db.subscription.updateMany({
          where: { stripeCustomerId: customerId },
          data: { status: "past_due" },
        });
        break;
      }
      default:
        // Otros eventos no nos interesan — Stripe manda muchos más de
        // los que necesitamos escuchar.
        break;
    }
  } catch (err) {
    console.error("Error procesando webhook de Stripe:", err);
    // Devolvemos 200 igual: si le devolvemos error, Stripe reintenta el
    // mismo evento muchas veces — mejor loguear y revisar a mano.
  }

  return NextResponse.json({ received: true });
}
