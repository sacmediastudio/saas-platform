import { requireTenant } from "@/lib/auth";
import { db } from "@/lib/db";
import OrdersView from "./orders-view";

export default async function OrdersPage() {
  const session = await requireTenant();
  const [tenant, orders] = await Promise.all([
    db.tenant.findUnique({
      where: { id: session.tenantId },
      select: {
        orderingEnabled: true,
        pickupEnabled: true,
        deliveryEnabled: true,
        deliveryFee: true,
        minDeliveryAmount: true,
        currency: true,
      },
    }),
    db.menuOrder.findMany({
      where: { tenantId: session.tenantId },
      include: { items: true },
      orderBy: { createdAt: "desc" },
      take: 200,
    }),
  ]);

  return (
    <OrdersView
      initialSettings={{
        orderingEnabled: tenant?.orderingEnabled ?? false,
        pickupEnabled: tenant?.pickupEnabled ?? true,
        deliveryEnabled: tenant?.deliveryEnabled ?? false,
        deliveryFee: tenant?.deliveryFee ?? null,
        minDeliveryAmount: tenant?.minDeliveryAmount ?? null,
      }}
      currency={tenant?.currency ?? "USD"}
      initialOrders={orders.map((o) => ({
        id: o.id,
        customerName: o.customerName,
        customerEmail: o.customerEmail,
        customerPhone: o.customerPhone,
        fulfillment: o.fulfillment,
        deliveryAddress: o.deliveryAddress,
        notes: o.notes,
        status: o.status,
        subtotal: o.subtotal,
        deliveryFee: o.deliveryFee,
        total: o.total,
        createdAt: o.createdAt.toISOString(),
        items: o.items.map((i) => ({ id: i.id, name: i.name, price: i.price, quantity: i.quantity })),
      }))}
    />
  );
}
