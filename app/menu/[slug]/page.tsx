import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import PublicMenu from "./public-menu";

export default async function PublicMenuPage({ params }: { params: { slug: string } }) {
  const tenant = await db.tenant.findUnique({ where: { slug: params.slug } });
  if (!tenant || tenant.businessType !== "RESTAURANT") notFound();

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
      }}
      categories={categories.map((c) => ({ id: c.id, name: c.name }))}
      items={items.map((i) => ({
        id: i.id,
        categoryId: i.categoryId,
        name: i.name,
        description: i.description,
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
