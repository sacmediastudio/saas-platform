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

  try {
    const portalSession = await stripe.billingPortal.sessions.create({
      customer: subscription.stripeCustomerId,
      return_url: `${origin}/dashboard/billing`,
    });
    return NextResponse.json({ url: portalSession.url });
  } catch (err: any) {
    // El cliente guardado no existe en este ambiente de Stripe (ej. se
    // migró de test mode a modo Live) — en la práctica, no hay una
    // suscripción real acá aunque la base de datos tenga un ID viejo
    // guardado. No tiene sentido "autocorregir" creando un cliente
    // nuevo vacío para el portal — hay que suscribirse de nuevo.
    if (err?.code === "resource_missing") {
      return NextResponse.json(
        { error: "Todavía no tenés una suscripción activa — hacé clic en \"Suscribirse\" primero." },
        { status: 400 }
      );
    }
    throw err;
  }
}
