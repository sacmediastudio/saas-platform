/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    // Patrones amplios a propósito, porque el dominio real de las fotos
    // depende de qué eligió cada instalación (R2 con su dominio público
    // por defecto, R2 con dominio propio, o S3/CloudFront) — ver
    // S3_PUBLIC_URL_BASE en .env.example. Si usas un dominio de CDN
    // personalizado que no calce con ninguno de estos, agrégalo acá.
    remotePatterns: [
      { protocol: "https", hostname: "*.r2.dev" },
      { protocol: "https", hostname: "*.r2.cloudflarestorage.com" },
      { protocol: "https", hostname: "*.amazonaws.com" },
      { protocol: "https", hostname: "images.hostinger.com" },
    ],
  },
};

module.exports = nextConfig;
