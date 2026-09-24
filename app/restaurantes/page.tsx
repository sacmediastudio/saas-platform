import type { Metadata } from "next";
import RestaurantPageClient from "./restaurant-page-client";

// El toggle ES/EN de esta página vive en el cliente (mismo patrón que
// la home) — el metadata del <head> no puede seguir ese cambio, así
// que queda fijo en español, el idioma por defecto del sitio (ver
// lang="es" en app/layout.tsx).
export const metadata: Metadata = {
  title: "Módulo Restaurantes | Zertoo",
  description:
    "Menú digital, avisos de pedidos por WhatsApp, varias ubicaciones y métricas de pedidos para tu restaurante — todo en un solo panel.",
};

export default function RestaurantPage() {
  return <RestaurantPageClient />;
}
