import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { upsertCustomer } from "@/lib/customers";
import { sendOrderConfirmationEmail } from "@/lib/email";

const schema = z.object({
  slug: z.string(),
  customerName: z.string().min(1).max(100),
  customerEmail: z.string().email(),
  customerPhone: z.string().min(6).max(30),
  fulfillment: z.enum(["PICKUP", "DELIVERY"]),
  deliveryAddress: z.string().max(300).optional(),
  notes: z.string().max(300).optional(),
  items: z
    .array(z.object({ menuItemId: z.string(), quantity: z.number().int().min(1).max(50) }))
    .min(1)
    .max(50),
});

// POST /api/public/menu-orders — el cliente arma su pedido en el menú
// público y lo manda; se paga al retirar/recibir, sin pasarela de pago
// online por ahora (ver README).
export async function POST(req: NextRequest) {
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
  });
  if (menuItems.length !== data.items.length) {
    return NextResponse.json({ error: "Algún plato ya no está disponible." }, { status: 400 });
  }

  const orderItems = data.items.map((i) => {
    const menuItem = menuItems.find((m) => m.id === i.menuItemId)!;
    return { name: menuItem.name, price: Number(menuItem.price), quantity: i.quantity };
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

  await sendOrderConfirmationEmail({
    to: data.customerEmail,
    customerName: data.customerName,
    businessName: tenant.name,
    fulfillment: data.fulfillment,
    items: orderItems,
    total,
    currency: tenant.currency,
  }).catch((err) => console.error("No se pudo enviar el correo de confirmación de pedido:", err));

  return NextResponse.json({ order }, { status: 201 });
}
