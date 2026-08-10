import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireTenant } from "@/lib/auth";
import { getStripe, getOrCreateStripeCustomer, isStripeConfigured, PRICE_ID_BY_MODULE } from "@/lib/stripe";
import { getEnabledModules } from "@/lib/modules";

// POST /api/billing/checkout — arma el checkout con un line item por
// cada módulo que el negocio tiene activo AHORA MISMO (Menú, Citas,
// Smartlink, o cualquier combinación) y redirige a la página de pago
// alojada por Stripe.
export async function POST(req: NextRequest) {
  const session = await requireTenant();

  if (!isStripeConfigured()) {
    return NextResponse.json(
      { error: "La facturación todavía no está configurada en esta plataforma." },
      { status: 503 }
    );
  }

  const tenant = await db.tenant.findUnique({ where: { id: session.tenantId } });
  if (!tenant) return NextResponse.json({ error: "Negocio no encontrado" }, { status: 404 });

  const enabledModules = getEnabledModules(tenant);
  const lineItems = enabledModules
    .map((m) => PRICE_ID_BY_MODULE[m])
    .filter((priceId): priceId is string => Boolean(priceId))
    .map((priceId) => ({ price: priceId, quantity: 1 }));

  if (lineItems.length === 0) {
    return NextResponse.json({ error: "No hay módulos activos para facturar." }, { status: 400 });
  }

  const customerId = await getOrCreateStripeCustomer(tenant.id);
  const origin = req.headers.get("origin") || `https://${req.headers.get("host")}`;

  const stripe = getStripe();
  const checkoutSession = await stripe.checkout.sessions.create({
    mode: "subscription",
    customer: customerId,
    line_items: lineItems,
    success_url: `${origin}/dashboard/billing?checkout=success`,
    cancel_url: `${origin}/dashboard/billing?checkout=cancelled`,
    subscription_data: {
      metadata: { tenantId: tenant.id },
    },
    metadata: { tenantId: tenant.id },
  });

  return NextResponse.json({ url: checkoutSession.url });
}
