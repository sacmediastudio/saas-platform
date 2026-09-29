import { db } from "./db";

// Lógica compartida para armar las líneas de un pedido a partir de un
// carrito — usada tanto por el pedido público (menú web, POST
// /api/public/menu-orders) como por el pedido que arma un mesero desde
// Zertoo Waiter (POST /api/tenant/dine-in-orders, Fase 2). Antes vivía
// duplicada solo en el endpoint público; se extrajo acá para que un
// pedido dine-in tenga exactamente las mismas garantías (precios
// reales, add-ons válidos, congelado de stationId para el enrutamiento
// de impresión) sin reescribir nada.

export interface CartItemInput {
  menuItemId: string;
  quantity: number;
  addOnIds?: string[];
  notes?: string;
}

export interface BuiltOrderItem {
  name: string;
  price: number;
  quantity: number;
  notes?: string;
  addOns?: { name: string; price: number }[];
  // Se congela acá, igual que name/price — si el negocio reconfigura
  // estaciones después, este pedido no cambia de dónde se imprime.
  // MenuItem.stationId manda si está seteado (anula la estación de su
  // categoría); si no, hereda la de MenuCategory.stationId.
  stationId: string | null;
}

export type OrderBuildResult =
  | { ok: true; items: BuiltOrderItem[]; subtotal: number }
  | { ok: false; error: string };

/**
 * Valida que los platos pedidos existan de verdad para ese tenant, que
 * ninguno tenga precio variable (no hay un número real para cobrar), y
 * arma cada línea con precio/add-ons reales de la base — nunca
 * confiando en lo que mande el cliente.
 */
export async function buildOrderItems(tenantId: string, cartItems: CartItemInput[]): Promise<OrderBuildResult> {
  const menuItems = await db.menuItem.findMany({
    where: { id: { in: cartItems.map((i) => i.menuItemId) }, tenantId },
    include: { addOns: true, category: { select: { stationId: true } } },
  });
  if (menuItems.length !== cartItems.length) {
    return { ok: false, error: "Algún plato ya no está disponible." };
  }
  const variablePriceItem = menuItems.find((m) => m.variablePrice);
  if (variablePriceItem) {
    return {
      ok: false,
      error: `"${variablePriceItem.name}" tiene precio variable — hay que consultarlo directo en el local.`,
    };
  }

  const items: BuiltOrderItem[] = cartItems.map((i) => {
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
      stationId: menuItem.stationId ?? menuItem.category.stationId ?? null,
    };
  });

  const subtotal = items.reduce((sum, i) => sum + i.price * i.quantity, 0);
  return { ok: true, items, subtotal };
}
