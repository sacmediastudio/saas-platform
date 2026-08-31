import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { db } from "@/lib/db";
import { recordPageView } from "@/lib/analytics";
import { getEnabledModules } from "@/lib/modules";
import { jsonLdScriptProps } from "@/lib/json-ld";
import { ensureTrialEndsAt, getBillingStatus } from "@/lib/billing-status";
import UnavailableMessage from "@/components/unavailable-message";
import BookingFlow from "./booking-flow";

export async function generateMetadata({ params }: { params: { slug: string } }): Promise<Metadata> {
  const tenant = await db.tenant.findUnique({
    where: { slug: params.slug },
    select: { name: true, heroTagline: true, heroImageUrl: true, logoUrl: true, address: true },
  });
  if (!tenant) return { title: "Zertoo" };

  const title = `${tenant.name} | Reserva tu cita`;
  const description =
    tenant.heroTagline ||
    `Reserva tu cita en ${tenant.name}${tenant.address ? ` en ${tenant.address}` : ""} — elige el servicio, la fecha y la hora, sin llamar.`;
  const image = tenant.heroImageUrl || tenant.logoUrl || undefined;

  return {
    title,
    description,
    openGraph: { title, description, type: "website", images: image ? [{ url: image }] : undefined },
    twitter: { card: "summary_large_image", title, description, images: image ? [image] : undefined },
  };
}

export default async function PublicBookingPage({ params }: { params: { slug: string } }) {
  const tenant = await db.tenant.findUnique({ where: { slug: params.slug } });
  if (!tenant || tenant.suspended || !getEnabledModules(tenant).includes("SMALL_BUSINESS")) notFound();

  const subscription = await db.subscription.findUnique({ where: { tenantId: tenant.id } });
  const trialEndsAt = await ensureTrialEndsAt(db, tenant);
  if (getBillingStatus({ trialEndsAt }, subscription) === "trial_expired") return <UnavailableMessage />;

  await recordPageView(tenant.id, "BOOK");

  const services = await db.service.findMany({ where: { tenantId: tenant.id } });
  const serialized = services.map((s) => ({
    id: s.id,
    name: s.name,
    description: s.description,
    imageUrl: s.imageUrl,
    durationMinutes: s.durationMinutes,
    price: Number(s.price),
    staffId: s.staffId,
  }));

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "LocalBusiness",
    name: tenant.name,
    ...(tenant.heroImageUrl || tenant.logoUrl ? { image: tenant.heroImageUrl || tenant.logoUrl } : {}),
    ...(tenant.address ? { address: { "@type": "PostalAddress", streetAddress: tenant.address } } : {}),
    ...(tenant.contactPhone ? { telephone: tenant.contactPhone } : {}),
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={jsonLdScriptProps(jsonLd)} />
      <BookingFlow
        tenantName={tenant.name}
        tenantSlug={tenant.slug}
        tenantTagline={tenant.heroTagline}
        logoUrl={tenant.logoUrl}
        heroImageUrl={tenant.heroImageUrl}
        contactEmail={tenant.contactEmail}
        contactPhone={tenant.contactPhone}
        address={tenant.address}
        services={serialized}
        currency={tenant.currency}
        themeBgColor={tenant.themeBgColor}
        themeTextColor={tenant.themeTextColor}
        buttonColor={tenant.buttonColor}
        buttonTextColor={tenant.buttonTextColor}
      />
    </>
  );
}
