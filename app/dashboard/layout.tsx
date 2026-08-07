import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import DashboardShell from "@/components/dashboard-shell";

export async function generateMetadata(): Promise<Metadata> {
  const session = await getSession();
  if (!session) return { title: "Zertoo" };
  const tenant = await db.tenant.findUnique({ where: { id: session.tenantId }, select: { name: true } });
  return { title: tenant ? `Zertoo | ${tenant.name}` : "Zertoo" };
}

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session) redirect("/login");

  const [tenant, user] = await Promise.all([
    db.tenant.findUnique({ where: { id: session.tenantId } }),
    db.user.findUnique({ where: { id: session.userId }, select: { emailVerified: true } }),
  ]);
  if (!tenant) redirect("/login");
  // Sin correo verificado, no se puede usar el dashboard — evita cuentas
  // creadas por bots y confirma que el dueño realmente controla ese correo.
  if (user && !user.emailVerified) redirect("/verify-email");
  // Una cuenta suspendida desde el panel de admin no puede usar el dashboard.
  if (tenant.suspended) redirect("/suspended");

  return (
    <DashboardShell
      tenant={{ name: tenant.name, logoUrl: tenant.logoUrl }}
      businessType={tenant.businessType}
    >
      {children}
    </DashboardShell>
  );
}
