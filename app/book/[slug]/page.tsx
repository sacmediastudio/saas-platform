import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import BookingFlow from "./booking-flow";

export default async function PublicBookingPage({ params }: { params: { slug: string } }) {
  const tenant = await db.tenant.findUnique({ where: { slug: params.slug } });
  if (!tenant) notFound();

  const services = await db.service.findMany({ where: { tenantId: tenant.id } });
  const serialized = services.map((s) => ({
    id: s.id,
    name: s.name,
    durationMinutes: s.durationMinutes,
    price: Number(s.price),
    staffId: s.staffId,
  }));

  return (
    <BookingFlow
      tenantName={tenant.name}
      services={serialized}
      currency={tenant.currency}
      themeBgColor={tenant.themeBgColor}
      themeTextColor={tenant.themeTextColor}
    />
  );
}
