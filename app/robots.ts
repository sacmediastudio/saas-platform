import type { MetadataRoute } from "next";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://zertoo.app";

// app/robots.ts — Next.js lo sirve automáticamente en /robots.txt.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/dashboard", "/admin", "/api"],
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
