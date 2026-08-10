import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireTenant } from "@/lib/auth";
import { getStripe, isStripeConfigured } from "@/lib/stripe";

// POST /api/billing/portal — redirige al portal de facturación alojado
// por Stripe, donde el negocio puede cambiar su tarjeta, ver facturas
// pasadas, o cancelar su suscripción por su cuenta.
export async function POST(req: NextRequest) {
  const session = await requireTenant();

  if (!isStripeConfigured()) {
    return NextResponse.json(
      { error: "La facturación todavía no está configurada en esta plataforma." },
      { status: 503 }
    );
  }

  const subscription = await db.subscription.findUnique({ where: { tenantId: session.tenantId } });
  if (!subscription?.stripeCustomerId) {
    return NextResponse.json({ error: "Todavía no tienes una suscripción activa." }, { status: 400 });
  }

  const origin = req.headers.get("origin") || `https://${req.headers.get("host")}`;
  const stripe = getStripe();
  const portalSession = await stripe.billingPortal.sessions.create({
    customer: subscription.stripeCustomerId,
    return_url: `${origin}/dashboard/billing`,
  });

  return NextResponse.json({ url: portalSession.url });
}
