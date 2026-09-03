import type { Metadata } from "next";
import "./globals.css";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://zertoo.app";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: "Zertoo | Menú digital, citas y smartlink para tu negocio",
  description:
    "Zertoo digitaliza tu negocio en minutos: menú digital para restaurantes, sistema de citas y perfil de enlaces. 14 días gratis, sin tarjeta de crédito.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
