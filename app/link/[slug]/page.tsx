import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { db } from "@/lib/db";
import { recordPageView } from "@/lib/analytics";
import { getEnabledModules } from "@/lib/modules";
import { jsonLdScriptProps } from "@/lib/json-ld";
import { ensureTrialEndsAt, getBillingStatus } from "@/lib/billing-status";
import UnavailableMessage from "@/components/unavailable-message";
import SmartLinkView from "./smartlink-view";

export async function generateMetadata({ params }: { params: { slug: string } }): Promise<Metadata> {
  const tenant = await db.tenant.findUnique({
    where: { slug: params.slug },
    select: { name: true, heroTagline: true, heroImageUrl: true, logoUrl: true },
  });
  if (!tenant) return { title: "Zertoo" };

  const title = `${tenant.name} | Todos mis links`;
  const description = tenant.heroTagline || `Todos los links y redes de ${tenant.name}, en un solo lugar.`;
  const image = tenant.heroImageUrl || tenant.logoUrl || undefined;

  return {
    title,
    description,
    openGraph: { title, description, type: "profile", images: image ? [{ url: image }] : undefined },
    twitter: { card: "summary_large_image", title, description, images: image ? [image] : undefined },
  };
}

export default async function PublicSmartLinkPage({ params }: { params: { slug: string } }) {
  const tenant = await db.tenant.findUnique({ where: { slug: params.slug } });
  if (!tenant || tenant.suspended || !getEnabledModules(tenant).includes("SMARTLINK")) notFound();

  const subscription = await db.subscription.findUnique({ where: { tenantId: tenant.id } });
  const trialEndsAt = await ensureTrialEndsAt(db, tenant);
  if (getBillingStatus({ trialEndsAt }, subscription) === "trial_expired") return <UnavailableMessage />;

  await recordPageView(tenant.id, "LINK");

  const items = await db.smartLinkItem.findMany({
    where: { tenantId: tenant.id },
    orderBy: { sortOrder: "asc" },
  });

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: tenant.name,
    ...(tenant.logoUrl ? { logo: tenant.logoUrl } : {}),
    ...(tenant.contactPhone ? { telephone: tenant.contactPhone } : {}),
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={jsonLdScriptProps(jsonLd)} />
      <SmartLinkView
        tenant={{
          name: tenant.name,
          slug: tenant.slug,
          logoUrl: tenant.logoUrl,
          heroImageUrl: tenant.heroImageUrl,
          heroTagline: tenant.heroTagline,
          themeBgColor: tenant.themeBgColor,
          themeTextColor: tenant.themeTextColor,
          buttonColor: tenant.buttonColor,
          buttonTextColor: tenant.buttonTextColor,
          contactPhone: tenant.contactPhone,
        }}
        items={items.map((i) => ({ id: i.id, type: i.type, label: i.label }))}
      />
    </>
  );
}
