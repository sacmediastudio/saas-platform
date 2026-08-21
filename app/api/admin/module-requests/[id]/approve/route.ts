import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/admin-auth";
import { getEnabledModules, type ModuleType } from "@/lib/modules";
import { getStripe, isStripeConfigured, PRICE_ID_BY_MODULE } from "@/lib/stripe";

// POST /api/admin/module-requests/[id]/approve — activa el módulo de
// verdad para ese negocio, sincroniza con Stripe si ya tiene una
// suscripción real (si todavía está en trial, se activa igual y se
// factura cuando eventualmente pase por checkout), y marca la
// solicitud como resuelta.
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
  const next = current.includes(target) ? current : [...current, target];

  // Mismo detalle que en el signup: si es la primera vez que se activa
  // Menú, le damos una categoría inicial para que no arranque vacío.
  if (target === "RESTAURANT" && !current.includes("RESTAURANT")) {
    const existingCategory = await db.menuCategory.findFirst({ where: { tenantId: tenant.id } });
    if (!existingCategory) {
      await db.menuCategory.create({ data: { tenantId: tenant.id, name: "Platos principales" } });
    }
  }

  await db.tenant.update({ where: { id: tenant.id }, data: { enabledModules: next } });

  if (isStripeConfigured()) {
    const subscription = await db.subscription.findUnique({
      where: { tenantId: tenant.id },
      include: { items: true },
    });

    if (subscription?.stripeSubscriptionId) {
      const priceId = PRICE_ID_BY_MODULE[target];
      const alreadyBilled = subscription.items.some((i) => i.module === target);
      if (priceId && !alreadyBilled) {
        try {
          const stripe = getStripe();
          const item = await stripe.subscriptionItems.create({
            subscription: subscription.stripeSubscriptionId,
            price: priceId,
            quantity: 1,
          });
          await db.subscriptionModuleItem.create({
            data: { subscriptionId: subscription.id, module: target, stripeItemId: item.id },
          });
        } catch (err) {
          console.error("No se pudo sincronizar la activación con Stripe:", err);
        }
      }
    }
  }

  const updatedRequest = await db.moduleActivationRequest.update({
    where: { id: request.id },
    data: { status: "approved", resolvedAt: new Date() },
  });

  return NextResponse.json({ request: updatedRequest });
}
