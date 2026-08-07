import { redirect } from "next/navigation";
import { requireTenant } from "@/lib/auth";
import { db } from "@/lib/db";

export default async function DashboardIndexPage() {
  const session = await requireTenant();
  const tenant = await db.tenant.findUnique({ where: { id: session.tenantId } });
  if (!tenant) redirect("/login");

  if (tenant.businessType === "RESTAURANT") redirect("/dashboard/menu");
  if (tenant.businessType === "SMALL_BUSINESS") redirect("/dashboard/bookings");
  redirect("/dashboard/smartlink");
}
