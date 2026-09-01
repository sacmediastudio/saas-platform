import Stripe from "stripe";
import { db } from "./db";
import type { ModuleType } from "./modules";

const SECRET_KEY = process.env.STRIPE_SECRET_KEY;

// Un Price de Stripe (recurrente, mensual) por módulo — se crean una
// sola vez en el dashboard de Stripe (Products), y acá solo guardamos
// su id. Así el precio real "vive" en Stripe (fuente de verdad para
// cobros), no hardcodeado en el código.
export const PRICE_ID_BY_MODULE: Record<ModuleType, string | undefined> = {
  RESTAURANT: process.env.STRIPE_PRICE_RESTAURANT,
  SMALL_BUSINESS: process.env.STRIPE_PRICE_SMALL_BUSINESS,
  SMARTLINK: process.env.STRIPE_PRICE_SMARTLINK,
};

export function isStripeConfigured(): boolean {
  return Boolean(
    SECRET_KEY && PRICE_ID_BY_MODULE.RESTAURANT && PRICE_ID_BY_MODULE.SMALL_BUSINESS && PRICE_ID_BY_MODULE.SMARTLINK
  );
}

let cachedClient: Stripe | null = null;
export function getStripe(): Stripe {
  if (cachedClient) return cachedClient;
  if (!SECRET_KEY) throw new Error("STRIPE_SECRET_KEY no está configurado");
  cachedClient = new Stripe(SECRET_KEY, { apiVersion: "2024-06-20" });
  return cachedClient;
}

/** Devuelve el Customer de Stripe del negocio, creándolo si es la primera vez. */
export async function getOrCreateStripeCustomer(tenantId: string): Promise<string> {
  const stripe = getStripe();

  const [tenant, subscription] = await Promise.all([
    db.tenant.findUnique({ where: { id: tenantId }, select: { name: true, contactEmail: true } }),
    db.subscription.findUnique({ where: { tenantId } }),
  ]);
  if (!tenant) throw new Error("Negocio no encontrado");

  if (subscription?.stripeCustomerId) {
    // Confirma que el cliente todavía exista del lado de Stripe antes
    // de reusarlo — si se cambió de test mode a modo Live (o de
    // cuenta de Stripe), un ID guardado de antes ya no existe ahí, y
    // conviene crear uno nuevo en silencio en vez de que la solicitud
    // falle con un error que el negocio no puede resolver por su cuenta.
    try {
      const existing = await stripe.customers.retrieve(subscription.stripeCustomerId);
      if (!("deleted" in existing && existing.deleted)) return subscription.stripeCustomerId;
    } catch (err: any) {
      if (err?.code !== "resource_missing") throw err;
      // el cliente guardado no existe en este ambiente — sigue de largo y crea uno nuevo
    }
  }

  const customer = await stripe.customers.create({
    name: tenant.name,
    email: tenant.contactEmail ?? undefined,
    metadata: { tenantId },
  });

  await db.subscription.upsert({
    where: { tenantId },
    update: { stripeCustomerId: customer.id },
    create: { tenantId, stripeCustomerId: customer.id },
  });

  return customer.id;
}

/**
 * Mapea el status de una suscripción de Stripe a nuestro campo simple
 * de texto (trialing | active | past_due | canceled) — Stripe tiene más
 * estados posibles (incomplete, unpaid, etc.), los agrupamos en algo
 * más simple de mostrar en el dashboard/admin.
 */
export function mapStripeStatus(stripeStatus: Stripe.Subscription.Status): string {
  switch (stripeStatus) {
    case "trialing":
      return "trialing";
    case "active":
      return "active";
    case "past_due":
    case "unpaid":
    case "incomplete":
      return "past_due";
    case "canceled":
    case "incomplete_expired":
      return "canceled";
    default:
      return "active";
  }
}

export function moduleForPriceId(priceId: string): ModuleType | null {
  const entry = (Object.entries(PRICE_ID_BY_MODULE) as [ModuleType, string | undefined][]).find(
    ([, id]) => id === priceId
  );
  return entry ? entry[0] : null;
}
