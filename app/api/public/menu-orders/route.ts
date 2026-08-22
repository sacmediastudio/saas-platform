import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { upsertCustomer } from "@/lib/customers";
import { sendOrderConfirmationEmail } from "@/lib/email";
import { sendOrderConfirmationWhatsApp, sendNewOrderAlertWhatsApp } from "@/lib/whatsapp";
import { formatCurrency } from "@/lib/currency";
import { rateLimit, getClientIp } from "@/lib/rate-limit";

const schema = z.object({
  slug: z.string(),
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
  if (data.fulfillment === "PICKUP" && !tenant.pickupEnabled) {
    return NextResponse.json({ error: "Este negocio no ofrece pickup." }, { status: 400 });
  }
  if (data.fulfillment === "DELIVERY") {
    if (!tenant.deliveryEnabled) {
      return NextResponse.json({ error: "Este negocio no ofrece delivery." }, { status: 400 });
    }
    if (!data.deliveryAddress) {
      return NextResponse.json({ error: "Falta la dirección de entrega." }, { status: 400 });
    }
  }

  // Precios reales de la base de datos, nunca confiar en lo que mande
  // el cliente — evita que alguien manipule el precio desde el navegador.
  const menuItems = await db.menuItem.findMany({
    where: { id: { in: data.items.map((i) => i.menuItemId) }, tenantId: tenant.id },
    include: { addOns: true },
  });
  if (menuItems.length !== data.items.length) {
    return NextResponse.json({ error: "Algún plato ya no está disponible." }, { status: 400 });
  }
  // Un plato de precio variable no tiene un número real para cobrar —
  // no debería llegar hasta acá (el botón de agregar no aparece para
  // esos platos), pero por las dudas se rechaza explícitamente en vez
  // de dejarlo pasar con precio 0.
  const variablePriceItem = menuItems.find((m) => m.variablePrice);
  if (variablePriceItem) {
    return NextResponse.json(
      { error: `"${variablePriceItem.name}" tiene precio variable — hay que consultarlo directo en el local.` },
      { status: 400 }
    );
  }

  const orderItems = data.items.map((i) => {
    const menuItem = menuItems.find((m) => m.id === i.menuItemId)!;
    // Solo se aceptan add-ons que de verdad pertenezcan a ESTE plato —
    // evita que alguien mande el id de un add-on de otro negocio/plato
    // para inflar o alterar el pedido.
    const selectedAddOns = (i.addOnIds ?? [])
      .map((id) => menuItem.addOns.find((a) => a.id === id))
      .filter((a): a is (typeof menuItem.addOns)[number] => Boolean(a));
    const addOnsTotal = selectedAddOns.reduce((sum, a) => sum + a.price, 0);

    return {
      name: menuItem.name,
      price: Number(menuItem.price) + addOnsTotal,
      quantity: i.quantity,
      notes: i.notes,
      addOns: selectedAddOns.length > 0 ? selectedAddOns.map((a) => ({ name: a.name, price: a.price })) : undefined,
    };
  });
  const subtotal = orderItems.reduce((sum, i) => sum + i.price * i.quantity, 0);
  const deliveryFee = data.fulfillment === "DELIVERY" ? (tenant.deliveryFee ?? 0) : 0;
  const total = subtotal + deliveryFee;

  if (data.fulfillment === "DELIVERY" && tenant.minDeliveryAmount && subtotal < tenant.minDeliveryAmount) {
    return NextResponse.json(
      { error: `El pedido mínimo para delivery es ${tenant.minDeliveryAmount}.` },
      { status: 400 }
    );
  }

  const order = await db.menuOrder.create({
    data: {
      tenantId: tenant.id,
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

  await upsertCustomer({
    tenantId: tenant.id,
    email: data.customerEmail,
    name: data.customerName,
    phone: data.customerPhone,
    source: "order",
  });

  const totalLabel = formatCurrency(total, tenant.currency);

  await sendOrderConfirmationEmail({
    to: data.customerEmail,
    customerName: data.customerName,
    businessName: tenant.name,
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
    businessName: tenant.name,
    total: totalLabel,
    language: data.language,
  }).catch((err) => console.error("No se pudo enviar la confirmación de pedido por WhatsApp:", err));

  // Aviso al NEGOCIO — al número de contacto configurado en Ajustes, no
  // al mismo número que usa para mandar mensajes (son cosas distintas).
  if (tenant.contactPhone) {
    await sendNewOrderAlertWhatsApp({
      toPhone: tenant.contactPhone,
      customerName: data.customerName,
      total: totalLabel,
    }).catch((err) => console.error("No se pudo avisarle al negocio del pedido nuevo por WhatsApp:", err));
  }

  return NextResponse.json({ order }, { status: 201 });
}
