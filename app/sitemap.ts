import type { MetadataRoute } from "next";
import { db } from "@/lib/db";
import { getEnabledModules } from "@/lib/modules";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://zertoo.app";

// app/sitemap.ts — Next.js lo sirve automáticamente en /sitemap.xml.
// Se regenera en cada visita (no hay caché manual que mantener) con la
// lista real de negocios activos y sus módulos habilitados.
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const tenants = await db.tenant.findMany({
    where: { suspended: false },
    select: { slug: true, businessType: true, enabledModules: true, updatedAt: true },
  });

  const staticPages: MetadataRoute.Sitemap = [
    { url: SITE_URL, changeFrequency: "weekly", priority: 1 },
    { url: `${SITE_URL}/signup`, changeFrequency: "monthly", priority: 0.5 },
    { url: `${SITE_URL}/login`, changeFrequency: "monthly", priority: 0.2 },
  ];

  const tenantPages: MetadataRoute.Sitemap = tenants.flatMap((t) => {
    const modules = getEnabledModules(t);
    const entries: MetadataRoute.Sitemap = [];
    if (modules.includes("RESTAURANT")) {
      entries.push({ url: `${SITE_URL}/menu/${t.slug}`, lastModified: t.updatedAt, changeFrequency: "weekly", priority: 0.8 });
    }
    if (modules.includes("SMALL_BUSINESS")) {
      entries.push({ url: `${SITE_URL}/book/${t.slug}`, lastModified: t.updatedAt, changeFrequency: "weekly", priority: 0.8 });
    }
    if (modules.includes("SMARTLINK")) {
      entries.push({ url: `${SITE_URL}/link/${t.slug}`, lastModified: t.updatedAt, changeFrequency: "weekly", priority: 0.7 });
    }
    return entries;
  });

  return [...staticPages, ...tenantPages];
}
