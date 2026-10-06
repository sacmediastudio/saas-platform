/** @type {import('next').NextConfig} */
const nextConfig = {
  // satori (recibos impresos, lib/receipt-render.ts) carga archivos .wasm
  // de su carpeta en node_modules (yoga, harfbuzz); si Next los empaqueta
  // dentro del bundle de la ruta, el .wasm queda afuera y el recibo falla
  // con ENOENT. Como paquetes externos se resuelven desde node_modules.
  experimental: {
    serverComponentsExternalPackages: ["satori", "harfbuzzjs", "sharp"],
  },
  images: {
    // El dominio real de esta instalación es el bucket público de R2 de
    // abajo (ver S3_PUBLIC_URL_BASE). Antes esto tenía comodines amplios
    // (*.r2.dev, *.amazonaws.com) — Next.js recomienda evitarlos: con un
    // comodín así, el optimizador de imágenes procesa/trae contenido de
    // *cualquier* subdominio de ese proveedor, no solo el nuestro (ver
    // GHSA-9g9p-9gw9-jx7f). Si algún día cambia el bucket o el proveedor,
    // actualizá este hostname.
    remotePatterns: [{ protocol: "https", hostname: "pub-0bb706fa36f34d78a7cd29ec15dec251.r2.dev" }],
  },
};

module.exports = nextConfig;
