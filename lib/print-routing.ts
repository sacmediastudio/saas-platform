// Fase 1, ítem 4 del plan de Zertoo Orders — agrupa las líneas de un
// pedido ya aceptado por estación de cocina/barra, para poder mandar
// un ticket separado a cada una. Cada MenuOrderItem ya trae su
// stationId congelado desde POST /api/public/menu-orders (ver ese
// archivo) — acá solo se agrupa, no se vuelve a resolver nada contra
// el menú actual.
//
// Esto es SOLO el enrutamiento (la data de "qué va a dónde"). Mandar
// esos bytes a una impresora real por LAN es el ítem 5 (Print Bridge),
// todavía no construido — el spike de Fase 0 ya confirmó que es viable.

export interface StationTicketItem {
  name: string;
  quantity: number;
  addOns: { name: string; price?: number }[] | null;
  notes: string | null;
}

export interface StationTicket {
  stationId: string | null;
  stationName: string; // "Sin estación" si stationId es null
  items: StationTicketItem[];
}

interface OrderItemForRouting {
  name: string;
  quantity: number;
  addOns: unknown;
  notes: string | null;
  stationId: string | null;
}

/**
 * Agrupa las líneas de un pedido por estación. Los ítems sin estación
 * asignada (categoría nunca enrutada) caen en un bucket "Sin estación"
 * — no se descartan, para que nunca se pierda un ítem del pedido por
 * un enrutamiento incompleto.
 */
export function buildStationTickets(
  items: OrderItemForRouting[],
  stationNamesById: Map<string, string>
): StationTicket[] {
  const byStation = new Map<string, StationTicket>();

  for (const item of items) {
    const key = item.stationId ?? "__unassigned__";
    if (!byStation.has(key)) {
      byStation.set(key, {
        stationId: item.stationId,
        stationName: item.stationId ? stationNamesById.get(item.stationId) ?? "Estación eliminada" : "Sin estación",
        items: [],
      });
    }
    byStation.get(key)!.items.push({
      name: item.name,
      quantity: item.quantity,
      addOns: Array.isArray(item.addOns) ? (item.addOns as StationTicketItem["addOns"]) : null,
      notes: item.notes,
    });
  }

  return Array.from(byStation.values());
}
