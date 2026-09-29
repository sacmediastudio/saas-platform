import { requirePagePermission } from "@/lib/auth";
import { db } from "@/lib/db";
import { getEnabledModules } from "@/lib/modules";
import OrdersView from "./orders-view";
import LocationsManager from "./locations-manager";
import StationsPrintersManager from "./stations-printers-manager";

export default async function OrdersPage() {
  const session = await requirePagePermission("ORDERS");
  const [tenant, orders, locations, stations, printers, categories] = await Promise.all([
    db.tenant.findUnique({
      where: { id: session.tenantId },
      select: {
        orderingEnabled: true,
        pickupEnabled: true,
        deliveryEnabled: true,
        deliveryFee: true,
        minDeliveryAmount: true,
        currency: true,
        businessType: true,
        enabledModules: true,
        ordersAutoAccept: true,
        ordersAutoPrint: true,
        printBridgeApiKeyCreatedAt: true,
      },
    }),
    db.menuOrder.findMany({
      where: { tenantId: session.tenantId },
      include: { items: true, location: { select: { name: true } } },
      orderBy: { createdAt: "desc" },
      take: 200,
    }),
    db.location.findMany({ where: { tenantId: session.tenantId }, orderBy: { sortOrder: "asc" } }),
    db.preparationStation.findMany({ where: { tenantId: session.tenantId }, orderBy: { name: "asc" } }),
    db.printer.findMany({
      where: { tenantId: session.tenantId },
      include: { station: { select: { id: true, name: true } } },
      orderBy: { name: "asc" },
    }),
    db.menuCategory.findMany({
      where: { tenantId: session.tenantId },
      select: { id: true, name: true, stationId: true },
      orderBy: { sortOrder: "asc" },
    }),
  ]);

  const ordersModuleEnabled = tenant ? getEnabledModules(tenant).includes("ORDERS") : false;

  return (
    <div className="flex flex-col gap-5">
      <OrdersView
        initialSettings={{
          orderingEnabled: tenant?.orderingEnabled ?? false,
          pickupEnabled: tenant?.pickupEnabled ?? true,
          deliveryEnabled: tenant?.deliveryEnabled ?? false,
          deliveryFee: tenant?.deliveryFee ?? null,
          minDeliveryAmount: tenant?.minDeliveryAmount ?? null,
          ordersAutoAccept: tenant?.ordersAutoAccept ?? false,
          ordersAutoPrint: tenant?.ordersAutoPrint ?? false,
        }}
        currency={tenant?.currency ?? "USD"}
        ordersModuleEnabled={ordersModuleEnabled}
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
          locationName: o.location?.name ?? null,
          items: o.items.map((i) => ({ id: i.id, name: i.name, price: i.price, quantity: i.quantity })),
        }))}
      />
      <LocationsManager initialLocations={locations} />
      <StationsPrintersManager
        moduleEnabled={ordersModuleEnabled}
        initialStations={stations}
        initialPrinters={printers}
        initialCategories={categories}
        initialPrintBridgeConfigured={Boolean(tenant?.printBridgeApiKeyCreatedAt)}
      />
    </div>
  );
}
