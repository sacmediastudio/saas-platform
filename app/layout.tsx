import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Tu plataforma SaaS",
  description: "Menú digital, reservas y reseñas para negocios pequeños",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
