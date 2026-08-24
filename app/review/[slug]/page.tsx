import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { db } from "@/lib/db";
import ReviewForm from "./review-form";

export async function generateMetadata({ params }: { params: { slug: string } }): Promise<Metadata> {
  const tenant = await db.tenant.findUnique({ where: { slug: params.slug }, select: { name: true } });
  return { title: tenant ? `Zertoo | Reseña para ${tenant.name}` : "Zertoo" };
}

export default async function PublicReviewPage({ params }: { params: { slug: string } }) {
  const tenant = await db.tenant.findUnique({ where: { slug: params.slug } });
  if (!tenant) notFound();

  const externalLinks = await db.externalReviewLink.findMany({
    where: { tenantId: tenant.id, enabled: true },
    orderBy: { sortOrder: "asc" },
  });

  return (
    <ReviewForm
      tenant={{
        name: tenant.name,
        slug: tenant.slug,
        logoUrl: tenant.logoUrl,
        themeBgColor: tenant.themeBgColor,
        themeTextColor: tenant.themeTextColor,
        buttonColor: tenant.buttonColor,
        buttonTextColor: tenant.buttonTextColor,
        menuCardColor: tenant.menuCardColor,
        menuPageTextColor: tenant.menuPageTextColor,
      }}
      externalLinks={externalLinks.map((l) => ({ id: l.id, platform: l.platform, label: l.label, url: l.url }))}
    />
  );
}
