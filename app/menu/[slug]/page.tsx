import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { db } from "@/lib/db";
import { recordPageView } from "@/lib/analytics";
import { getEnabledModules } from "@/lib/modules";
import PublicMenu from "./public-menu";

export async function generateMetadata({ params }: { params: { slug: string } }): Promise<Metadata> {
  const tenant = await db.tenant.findUnique({ where: { slug: params.slug }, select: { name: true } });
  return { title: tenant ? `Zertoo | ${tenant.name}` : "Zertoo" };
}

export default async function PublicMenuPage({ params }: { params: { slug: string } }) {
  const tenant = await db.tenant.findUnique({ where: { slug: params.slug } });
  if (!tenant || !getEnabledModules(tenant).includes("RESTAURANT")) notFound();

  await recordPageView(tenant.id, "MENU");

  const [categories, items, reviews] = await Promise.all([
    db.menuCategory.findMany({ where: { tenantId: tenant.id }, orderBy: { sortOrder: "asc" } }),
    db.menuItem.findMany({ where: { tenantId: tenant.id }, orderBy: { sortOrder: "asc" } }),
    db.review.findMany({ where: { tenantId: tenant.id, status: "PUBLISHED" } }),
  ]);

  const avgRating =
    reviews.length > 0 ? reviews.reduce((s, r) => s + r.rating, 0) / reviews.length : null;

  return (
    <PublicMenu
      tenant={{
        name: tenant.name,
        slug: tenant.slug,
        logoUrl: tenant.logoUrl,
        heroImageUrl: tenant.heroImageUrl,
        heroTagline: tenant.heroTagline,
        contactEmail: tenant.contactEmail,
        contactPhone: tenant.contactPhone,
        address: tenant.address,
        currency: tenant.currency,
        themeBgColor: tenant.themeBgColor,
        themeTextColor: tenant.themeTextColor,
        buttonColor: tenant.buttonColor,
        buttonTextColor: tenant.buttonTextColor,
        menuShowPhotos: tenant.menuShowPhotos,
        menuLeadEnabled: tenant.menuLeadEnabled,
        menuLeadButtonLabel: tenant.menuLeadButtonLabel,
      }}
      categories={categories.map((c) => ({ id: c.id, name: c.name, nameEn: c.nameEn }))}
      items={items.map((i) => ({
        id: i.id,
        categoryId: i.categoryId,
        name: i.name,
        description: i.description,
        descriptionEn: i.descriptionEn,
        price: Number(i.price),
        status: i.status,
        featured: i.featured,
        imageUrl: i.imageUrl,
      }))}
      avgRating={avgRating}
      reviewCount={reviews.length}
    />
  );
}
