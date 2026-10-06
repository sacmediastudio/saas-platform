import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requirePrintBridgeAuth } from "@/lib/print-bridge-auth";
import { withAuthErrors } from "@/lib/api-route";
import { loadReceiptData, renderReceipt } from "@/lib/receipt-render";

// GET /api/print-bridge/jobs — el Print Bridge (proceso en la red del
// restaurante, ver zertoo-print-bridge/README.md) hace polling acá
// cada pocos segundos. Devuelve, agrupadas por estación, las líneas de
// pedidos aceptados que todavía no se imprimieron.
export async function GET(req: Request) {
  return withAuthErrors(async () => {
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

    // Recibos del cliente pendientes (pedido ya pagado, ver
    // lib/order-payments.ts). Se renderizan a imagen acá para que la app
    // solo mande bytes — ver lib/receipt-render.ts. Un fallo del recibo
    // nunca debe tumbar los tickets de cocina de arriba.
    const receipts: {
      orderId: string;
      printer: { ipAddress: string; port: number } | null;
      bytesPerRow?: number;
      height?: number;
      dataBase64?: string;
    }[] = [];
    try {
      const pending = await db.menuOrder.findMany({
        where: { tenantId, receiptPrintPending: true, paidAt: { not: null } },
        select: { id: true },
        orderBy: { paidAt: "asc" },
        take: 5,
      });
      if (pending.length > 0) {
        // La impresora marcada "Imprime recibos"; si no hay, la primera por nombre.
        const printer = await db.printer.findFirst({
          where: { tenantId },
          orderBy: [{ printsReceipts: "desc" }, { name: "asc" }],
        });
        for (const { id } of pending) {
          if (!printer) {
            receipts.push({ orderId: id, printer: null });
            continue;
          }
          const data = await loadReceiptData(id, tenantId);
          if (!data) continue;
          const raster = await renderReceipt(data);
          receipts.push({
            orderId: id,
            printer: { ipAddress: printer.ipAddress, port: printer.port },
            bytesPerRow: raster.bytesPerRow,
            height: raster.height,
            dataBase64: raster.data.toString("base64"),
          });
        }
      }
    } catch (err) {
      console.error("No se pudieron preparar los recibos pendientes:", err);
    }

    return NextResponse.json({ jobs, receipts });
  });
}
