import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { db } from "@/lib/db";
import { recordPageView } from "@/lib/analytics";
import { getEnabledModules } from "@/lib/modules";
import { jsonLdScriptProps } from "@/lib/json-ld";
import PublicMenu from "./public-menu";

export async function generateMetadata({ params }: { params: { slug: string } }): Promise<Metadata> {
  const tenant = await db.tenant.findUnique({
    where: { slug: params.slug },
    select: { name: true, heroTagline: true, heroImageUrl: true, logoUrl: true, address: true },
  });
  if (!tenant) return { title: "Zertoo" };

  const title = `${tenant.name} | Menú digital`;
  const description =
    tenant.heroTagline ||
    `Ve el menú de ${tenant.name}${tenant.address ? ` en ${tenant.address}` : ""} — platos, precios y fotos, actualizado al momento.`;
  const image = tenant.heroImageUrl || tenant.logoUrl || undefined;

  return {
    title,
    description,
    openGraph: { title, description, type: "website", images: image ? [{ url: image }] : undefined },
    twitter: { card: "summary_large_image", title, description, images: image ? [image] : undefined },
  };
}

export default async function PublicMenuPage({ params }: { params: { slug: string } }) {
  const tenant = await db.tenant.findUnique({ where: { slug: params.slug } });
  if (!tenant || tenant.suspended || !getEnabledModules(tenant).includes("RESTAURANT")) notFound();

  await recordPageView(tenant.id, "MENU");

  const [categories, items, reviews] = await Promise.all([
    db.menuCategory.findMany({ where: { tenantId: tenant.id }, orderBy: { sortOrder: "asc" } }),
    db.menuItem.findMany({
      where: { tenantId: tenant.id },
      include: { addOns: { orderBy: { sortOrder: "asc" } } },
      orderBy: { sortOrder: "asc" },
    }),
    db.review.findMany({ where: { tenantId: tenant.id, status: "PUBLISHED" } }),
  ]);

  const avgRating =
    reviews.length > 0 ? reviews.reduce((s, r) => s + r.rating, 0) / reviews.length : null;

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Restaurant",
    name: tenant.name,
    ...(tenant.heroImageUrl || tenant.logoUrl ? { image: tenant.heroImageUrl || tenant.logoUrl } : {}),
    ...(tenant.address ? { address: { "@type": "PostalAddress", streetAddress: tenant.address } } : {}),
    ...(tenant.contactPhone ? { telephone: tenant.contactPhone } : {}),
    ...(avgRating
      ? { aggregateRating: { "@type": "AggregateRating", ratingValue: avgRating, reviewCount: reviews.length } }
      : {}),
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={jsonLdScriptProps(jsonLd)} />
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
          secondaryCurrencyCode: tenant.secondaryCurrencyCode,
          secondaryCurrencyRate: tenant.secondaryCurrencyRate,
          themeBgColor: tenant.themeBgColor,
          themeTextColor: tenant.themeTextColor,
          buttonColor: tenant.buttonColor,
          buttonTextColor: tenant.buttonTextColor,
          menuCardColor: tenant.menuCardColor,
          menuPageTextColor: tenant.menuPageTextColor,
          menuShowPhotos: tenant.menuShowPhotos,
          menuLeadEnabled: tenant.menuLeadEnabled,
          menuLeadButtonLabel: tenant.menuLeadButtonLabel,
          orderingEnabled: tenant.orderingEnabled,
          pickupEnabled: tenant.pickupEnabled,
          deliveryEnabled: tenant.deliveryEnabled,
          deliveryFee: tenant.deliveryFee,
          minDeliveryAmount: tenant.minDeliveryAmount,
        }}
        categories={categories.map((c) => ({ id: c.id, name: c.name, nameEn: c.nameEn }))}
        items={items.map((i) => ({
          id: i.id,
          categoryId: i.categoryId,
          name: i.name,
          description: i.description,
          descriptionEn: i.descriptionEn,
          price: Number(i.price),
          variablePrice: i.variablePrice,
          status: i.status,
          featured: i.featured,
          imageUrl: i.imageUrl,
          addOns: i.addOns.map((a) => ({ id: a.id, name: a.name, price: a.price })),
        }))}
        avgRating={avgRating}
        reviewCount={reviews.length}
      />
    </>
  );
}
