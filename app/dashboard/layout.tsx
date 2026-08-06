import Link from "next/link";
import { redirect } from "next/navigation";
import { UtensilsCrossed, Calendar, Link2, Star, Settings } from "lucide-react";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session) redirect("/login");

  const tenant = await db.tenant.findUnique({ where: { id: session.tenantId } });
  if (!tenant) redirect("/login");

  // El nav solo muestra el módulo que corresponde al tipo de negocio:
  // un restaurante ve "Menú" y no "Citas"; un negocio de servicios ve
  // "Citas" y no "Menú". Reseñas, Ajustes son comunes a ambos.
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
    <div className="min-h-screen bg-neutral-900 text-neutral-100 grid grid-cols-[220px_1fr]">
      <aside className="border-r border-neutral-800 p-4 flex flex-col gap-1">
        <div className="flex items-center gap-2 px-2 pb-5">
          {tenant.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={tenant.logoUrl} alt="" className="w-7 h-7 rounded-lg object-cover shrink-0" />
          ) : (
            <div className="w-7 h-7 rounded-lg bg-white shrink-0" />
          )}
          <span className="text-sm font-medium">{tenant.name}</span>
        </div>
        <nav className="flex flex-col gap-0.5">
          {navItems.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className="flex items-center gap-2.5 px-2.5 py-2 rounded-md text-sm text-neutral-400 hover:bg-neutral-800 hover:text-neutral-100 aria-[current=page]:bg-neutral-800 aria-[current=page]:text-neutral-100 transition-colors"
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
