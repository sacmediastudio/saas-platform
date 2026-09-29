import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requirePrintBridgeAuth } from "@/lib/print-bridge-auth";

// GET /api/print-bridge/jobs — el Print Bridge (proceso en la red del
// restaurante, ver zertoo-print-bridge/README.md) hace polling acá
// cada pocos segundos. Devuelve, agrupadas por estación, las líneas de
// pedidos aceptados que todavía no se imprimieron.
export async function GET(req: Request) {
  const tenantId = await requirePrintBridgeAuth(req);

  const orders = await db.menuOrder.findMany({
    where: {
      tenantId,
      status: { in: ["ACCEPTED", "PREPARING"] },
      items: { some: { printedAt: null } },
    },
    include: { items: { where: { printedAt: null } } },
    orderBy: { createdAt: "asc" },
  });

  const stationIds = [
    ...new Set(orders.flatMap((o) => o.items.map((i) => i.stationId).filter((id): id is string => Boolean(id)))),
  ];
  const stations = stationIds.length
    ? await db.preparationStation.findMany({
        where: { id: { in: stationIds }, tenantId },
        include: { printers: true },
      })
    : [];
  const stationById = new Map(stations.map((s) => [s.id, s]));

  const jobs = orders.flatMap((order) => {
    const byStation = new Map<string, typeof order.items>();
    for (const item of order.items) {
      const key = item.stationId ?? "__unassigned__";
      if (!byStation.has(key)) byStation.set(key, []);
      byStation.get(key)!.push(item);
    }
    return Array.from(byStation.entries()).map(([key, items]) => {
      const station = key === "__unassigned__" ? null : stationById.get(key);
      // MVP: una sola impresora por estación — si hay más de una
      // registrada, se usa la primera (ampliar cuando haga falta).
      const printer = station?.printers[0] ?? null;
      return {
        orderId: order.id,
        stationId: station?.id ?? null,
        stationName: station?.name ?? "Sin estación",
        printer: printer ? { ipAddress: printer.ipAddress, port: printer.port } : null,
        items: items.map((i) => ({ id: i.id, name: i.name, quantity: i.quantity, addOns: i.addOns, notes: i.notes })),
      };
    });
  });

  return NextResponse.json({ jobs });
}
