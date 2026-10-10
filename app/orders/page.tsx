import type { Metadata } from "next";
import OrdersPageClient from "./orders-page-client";

// El toggle ES/EN de esta página vive en el cliente (mismo patrón que
// /restaurantes) — el metadata queda fijo en español.
export const metadata: Metadata = {
  title: "Zertoo Orders | Zertoo",
  description:
    "Pedidos online y del salón, impresión a cocina, mesas, mesero, cobro y recibos — toda la operación de tu restaurante desde un iPad.",
};

export default function OrdersPage() {
  return <OrdersPageClient />;
}
