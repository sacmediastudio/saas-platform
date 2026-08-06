import Link from "next/link";
import { redirect } from "next/navigation";
import { UtensilsCrossed, Calendar, Link2, Star, Settings } from "lucide-react";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";

const LOGO = "/logo.svg";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session) redirect("/login");

  const tenant = await db.tenant.findUnique({ where: { id: session.tenantId } });
  if (!tenant) redirect("/login");

  // El nav solo muestra el módulo que corresponde al tipo de negocio.
  const navItems = [
    tenant.businessType === "RESTAURANT" && {
      href: "/dashboard/menu",
      label: "Menú",
      icon: UtensilsCrossed,
    },
    tenant.businessType === "SMALL_BUSINESS" && {
      href: "/dashboard/bookings",
      label: "Citas",
      icon: Calendar,
    },
    tenant.businessType === "SMARTLINK" && {
      href: "/dashboard/smartlink",
      label: "Smartlink",
      icon: Link2,
    },
    { href: "/dashboard/reviews", label: "Reseñas", icon: Star },
    { href: "/dashboard/settings", label: "Ajustes", icon: Settings },
  ].filter(Boolean) as { href: string; label: string; icon: typeof Star }[];

  return (
    <div className="min-h-screen bg-white text-[#002D09] grid grid-cols-[240px_1fr]">
      <aside className="border-r border-[#002D09]/[0.08] p-5 flex flex-col gap-6">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={LOGO} alt="Zertoo" className="h-7 w-auto" />

        <div className="flex items-center gap-2.5 px-1">
          {tenant.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={tenant.logoUrl} alt="" className="w-8 h-8 rounded-lg object-cover shrink-0" />
          ) : (
            <div className="w-8 h-8 rounded-lg bg-[#F7F8F4] flex items-center justify-center shrink-0 text-xs font-bold">
              {tenant.name.charAt(0).toUpperCase()}
            </div>
          )}
          <span className="text-sm font-semibold truncate">{tenant.name}</span>
        </div>

        <nav className="flex flex-col gap-0.5">
          {navItems.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-medium text-[#343233] hover:bg-[#F7F8F4] hover:text-[#002D09] aria-[current=page]:bg-[#002D09] aria-[current=page]:text-white transition-colors"
            >
              <Icon size={16} aria-hidden />
              {label}
            </Link>
          ))}
        </nav>
      </aside>
      <main className="p-8">{children}</main>
    </div>
  );
}
