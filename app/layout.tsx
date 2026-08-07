import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Zertoo | Menú digital, citas y smartlink para tu negocio",
  description:
    "Zertoo digitaliza tu negocio en minutos: menú digital para restaurantes, sistema de citas y perfil de enlaces. 7 días gratis, sin tarjeta de crédito.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
