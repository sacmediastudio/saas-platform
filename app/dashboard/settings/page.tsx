import { redirect } from "next/navigation";
import { requireTenant } from "@/lib/auth";
import { db } from "@/lib/db";
import SettingsForm from "./settings-form";

export default async function SettingsPage() {
  const session = await requireTenant();
  const tenant = await db.tenant.findUnique({ where: { id: session.tenantId } });
  if (!tenant) redirect("/login");

  return (
    <SettingsForm
      tenant={{
        name: tenant.name,
        slug: tenant.slug,
        businessType: tenant.businessType,
        logoUrl: tenant.logoUrl,
        heroImageUrl: tenant.heroImageUrl,
        heroTagline: tenant.heroTagline,
        menuShowPhotos: tenant.menuShowPhotos,
        contactEmail: tenant.contactEmail,
        contactPhone: tenant.contactPhone,
        address: tenant.address,
        currency: tenant.currency,
        themeBgColor: tenant.themeBgColor,
        themeTextColor: tenant.themeTextColor,
        buttonColor: tenant.buttonColor,
        buttonTextColor: tenant.buttonTextColor,
      }}
    />
  );
}
