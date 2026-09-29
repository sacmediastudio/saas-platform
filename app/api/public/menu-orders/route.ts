import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { upsertCustomer } from "@/lib/customers";
import { sendOrderConfirmationEmail } from "@/lib/email";
import { sendOrderConfirmationWhatsApp, sendNewOrderAlertWhatsApp } from "@/lib/whatsapp";
import { formatCurrency } from "@/lib/currency";
import { rateLimit, getClientIp } from "@/lib/rate-limit";
import { getEnabledModules } from "@/lib/modules";
import { buildOrderItems } from "@/lib/order-builder";

const schema = z.object({
  slug: z.string(),
  // Solo aplica a negocios con más de una ubicación cargada — ver
  // Location en el schema. Un negocio de un solo local nunca la manda.
  locationId: z.string().optional(),
  customerName: z.string().min(1).max(100),
  customerEmail: z.string().email(),
  customerPhone: z.string().min(6).max(30),
  fulfillment: z.enum(["PICKUP", "DELIVERY"]),
  deliveryAddress: z.string().max(300).optional(),
  notes: z.string().max(300).optional(),
  language: z.enum(["es", "en"]).default("es"),
  items: z
    .array(
      z.object({
        menuItemId: z.string(),
        quantity: z.number().int().min(1).max(50),
        addOnIds: z.array(z.string()).max(20).optional(),
        notes: z.string().max(200).optional(), // algo muy específico de ESA línea, ej. "sin cebolla"
      })
    )
    .min(1)
    .max(50),
});

// POST /api/public/menu-orders — el cliente arma su pedido en el menú
// público y lo manda; se paga al retirar/recibir, sin pasarela de pago
// online por ahora (ver README).
export async function POST(req: NextRequest) {
  // Cada pedido manda 2 WhatsApp reales (cliente + negocio) más un
  // correo — 10 por hora por IP, generoso para un cliente real pero
  // frena a alguien mandando pedidos falsos en bucle.
  const { allowed, retryAfterSeconds } = rateLimit(`menu-orders:${getClientIp(req)}`, 10, 60 * 60_000);
  if (!allowed) {
    return NextResponse.json(
      { error: "Demasiados pedidos seguidos. Intenta de nuevo en un rato." },
      { status: 429, headers: { "Retry-After": String(retryAfterSeconds) } }
    );
  }

  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Datos inválidos" }, { status: 400 });
  }
  const data = parsed.data;

  const tenant = await db.tenant.findUnique({ where: { slug: data.slug } });
  if (!tenant || !tenant.orderingEnabled) {
    return NextResponse.json({ error: "Los pedidos no están disponibles en este negocio." }, { status: 404 });
  }

  // Si el negocio tiene ubicaciones cargadas, el pedido tiene que traer
  // una válida y activa — la config de pickup/delivery/fee de ESA
  // location manda en vez de la del Tenant. Un negocio sin ubicaciones
  // sigue funcionando exactamente como antes.
  const locations = await db.location.findMany({ where: { tenantId: tenant.id, isActive: true } });
  let location: (typeof locations)[number] | null = null;
  if (locations.length > 0) {
    location = locations.find((l) => l.id === data.locationId) ?? null;
    if (!location) {
      return NextResponse.json({ error: "Elegí una ubicación válida." }, { status: 400 });
    }
  }

  const effectivePickupEnabled = location ? location.pickupEnabled : tenant.pickupEnabled;
  const effectiveDeliveryEnabled = location ? location.deliveryEnabled : tenant.deliveryEnabled;
  const effectiveDeliveryFee = location ? location.deliveryFee : tenant.deliveryFee;
  const effectiveMinDeliveryAmount = location ? location.minDeliveryAmount : tenant.minDeliveryAmount;

  if (data.fulfillment === "PICKUP" && !effectivePickupEnabled) {
    return NextResponse.json({ error: "Este negocio no ofrece pickup." }, { status: 400 });
  }
  if (data.fulfillment === "DELIVERY") {
    if (!effectiveDeliveryEnabled) {
      return NextResponse.json({ error: "Este negocio no ofrece delivery." }, { status: 400 });
    }
    if (!data.deliveryAddress) {
      return NextResponse.json({ error: "Falta la dirección de entrega." }, { status: 400 });
    }
  }

  // Precios reales de la base de datos, add-ons válidos y stationId
  // congelado — misma lógica que usa el pedido de un mesero (Fase 2).
  const built = await buildOrderItems(tenant.id, data.items);
  if (!built.ok) {
    return NextResponse.json({ error: built.error }, { status: 400 });
  }
  const orderItems = built.items;
  const subtotal = built.subtotal;
  const deliveryFee = data.fulfillment === "DELIVERY" ? (effectiveDeliveryFee ?? 0) : 0;
  const total = subtotal + deliveryFee;

  if (data.fulfillment === "DELIVERY" && effectiveMinDeliveryAmount && subtotal < effectiveMinDeliveryAmount) {
    return NextResponse.json(
      { error: `El pedido mínimo para delivery es ${effectiveMinDeliveryAmount}.` },
      { status: 400 }
    );
  }

  let order = await db.menuOrder.create({
    data: {
      tenantId: tenant.id,
      locationId: location?.id,
      customerName: data.customerName,
      customerEmail: data.customerEmail.toLowerCase().trim(),
      customerPhone: data.customerPhone,
      fulfillment: data.fulfillment,
      deliveryAddress: data.deliveryAddress,
      notes: data.notes,
      language: data.language,
      subtotal,
      deliveryFee,
      total,
      items: { create: orderItems },
    },
    include: { items: true },
  });

  // Auto Accept (Fase 1, ítem 3) — solo tiene efecto si el módulo Orders
  // está activo, aunque el toggle haya quedado guardado en true. Salta
  // directo a ACCEPTED sin pasar por "Nuevos" en el tablero en vivo; no
  // dispara el WhatsApp de "confirmado en X minutos" porque ese requiere
  // un ETA que acá nadie eligió a mano.
  if (tenant.ordersAutoAccept && getEnabledModules(tenant).includes("ORDERS")) {
    order = await db.menuOrder.update({
      where: { id: order.id },
      data: { status: "ACCEPTED", acceptedAt: new Date() },
      include: { items: true },
    });
  }

  await upsertCustomer({
    tenantId: tenant.id,
    email: data.customerEmail,
    name: data.customerName,
    phone: data.customerPhone,
    source: "order",
  });

  const totalLabel = formatCurrency(total, tenant.currency);
  // Con varias ubicaciones, "tu pedido en {negocio}" a secas sería
  // ambiguo — se usa el nombre de la location elegida cuando existe.
  const businessName = location ? `${tenant.name} - ${location.name}` : tenant.name;

  await sendOrderConfirmationEmail({
    to: data.customerEmail,
    customerName: data.customerName,
    businessName,
    fulfillment: data.fulfillment,
    items: orderItems,
    total,
    currency: tenant.currency,
  }).catch((err) => console.error("No se pudo enviar el correo de confirmación de pedido:", err));

  // Confirmación al cliente por WhatsApp — complementa el correo, no lo
  // reemplaza (si WhatsApp no está configurado, esto no hace nada).
  await sendOrderConfirmationWhatsApp({
    toPhone: data.customerPhone,
    customerName: data.customerName,
    businessName,
    total: totalLabel,
    language: data.language,
  }).catch((err) => console.error("No se pudo enviar la confirmación de pedido por WhatsApp:", err));

  // Aviso al NEGOCIO — al WhatsApp de la ubicación elegida si tiene uno
  // propio cargado, si no al contacto general del Tenant (son cosas
  // distintas del número que USA para mandar mensajes).
  const alertPhone = location?.contactPhone || tenant.contactPhone;
  if (alertPhone) {
    // WhatsApp rechaza las variables de plantilla que contengan saltos
    // de línea (error 21656 de Twilio, "Content Variables parameter is
    // invalid") — por eso se separan los ítems con " · " en vez de
    // "\n", aunque quede menos prolijo que una lista real.
    let itemsSummary = orderItems
      .map((i) => {
        let line = `${i.quantity}x ${i.name}`;
        if (i.addOns && i.addOns.length > 0) line += ` (+ ${i.addOns.map((a) => a.name).join(", ")})`;
        if (i.notes) line += ` — ${i.notes}`;
        return line;
      })
      .join(" · ");
    if (data.notes) itemsSummary += ` · 📝 ${data.notes}`;

    const fulfillmentInfo =
      data.fulfillment === "DELIVERY" ? `🚗 Delivery: ${data.deliveryAddress}` : "🏪 Retiro en el local";

    await sendNewOrderAlertWhatsApp({
      toPhone: alertPhone,
      customerName: data.customerName,
      customerPhone: data.customerPhone,
      itemsSummary,
      fulfillmentInfo,
      total: totalLabel,
      language: tenant.alertLanguage,
    }).catch((err) => console.error("No se pudo avisarle al negocio del pedido nuevo por WhatsApp:", err));
  }

  return NextResponse.json({ order }, { status: 201 });
}
