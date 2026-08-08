import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { db } from "@/lib/db";
import { recordPageView } from "@/lib/analytics";
import { getEnabledModules } from "@/lib/modules";
import BookingFlow from "./booking-flow";

export async function generateMetadata({ params }: { params: { slug: string } }): Promise<Metadata> {
  const tenant = await db.tenant.findUnique({ where: { slug: params.slug }, select: { name: true } });
  return { title: tenant ? `Zertoo | ${tenant.name}` : "Zertoo" };
}

export default async function PublicBookingPage({ params }: { params: { slug: string } }) {
  const tenant = await db.tenant.findUnique({ where: { slug: params.slug } });
  if (!tenant || !getEnabledModules(tenant).includes("SMALL_BUSINESS")) notFound();

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

  return (
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
  );
}
