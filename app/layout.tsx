import type { Metadata } from "next";
import "./globals.css";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://zertoo.app";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: "Zertoo | Menú digital, Zertoo Eats y smartlink para tu restaurante",
  description:
    "Zertoo digitaliza tu restaurante en minutos: menú digital, descubrimiento y pedidos con Zertoo Eats, y un perfil de enlaces gratis incluido. 14 días gratis, sin tarjeta de crédito.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
