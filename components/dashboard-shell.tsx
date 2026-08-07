"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, X, UtensilsCrossed, Calendar, Link2, Star, Settings, Blocks } from "lucide-react";

const LOGO = "/logo.svg";

type ModuleType = "RESTAURANT" | "SMALL_BUSINESS" | "SMARTLINK";

const MODULE_NAV: Record<ModuleType, { href: string; label: string; icon: any }> = {
  RESTAURANT: { href: "/dashboard/menu", label: "Menú", icon: UtensilsCrossed },
  SMALL_BUSINESS: { href: "/dashboard/bookings", label: "Citas", icon: Calendar },
  SMARTLINK: { href: "/dashboard/smartlink", label: "Smartlink", icon: Link2 },
};
const MODULE_ORDER: ModuleType[] = ["RESTAURANT", "SMALL_BUSINESS", "SMARTLINK"];

export default function DashboardShell({
  tenant,
  enabledModules,
  children,
}: {
  tenant: { name: string; logoUrl: string | null };
  enabledModules: ModuleType[];
  children: React.ReactNode;
}) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const pathname = usePathname();

  // El nav muestra un link por cada módulo activo del negocio (puede
  // ser más de uno), en un orden fijo, más las secciones comunes.
  const navItems = [
    ...MODULE_ORDER.filter((m) => enabledModules.includes(m)).map((m) => MODULE_NAV[m]),
    { href: "/dashboard/reviews", label: "Reseñas", icon: Star },
    { href: "/dashboard/modules", label: "Módulos", icon: Blocks },
    { href: "/dashboard/settings", label: "Ajustes", icon: Settings },
  ];

  const TenantBadge = ({ size = "w-8 h-8" }: { size?: string }) =>
    tenant.logoUrl ? (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={tenant.logoUrl} alt="" className={`${size} rounded-lg object-cover shrink-0`} />
    ) : (
      <div className={`${size} rounded-lg bg-[#F7F8F4] flex items-center justify-center shrink-0 text-xs font-bold`}>
        {tenant.name.charAt(0).toUpperCase()}
      </div>
    );

  const NavLinks = ({ onNavigate }: { onNavigate?: () => void }) => (
    <nav className="flex flex-col gap-0.5">
      {navItems.map(({ href, label, icon: Icon }) => {
        const active = pathname === href;
        return (
          <Link
            key={href}
            href={href}
            onClick={onNavigate}
            className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors ${
              active ? "bg-[#002D09] text-white" : "text-[#343233] hover:bg-[#F7F8F4] hover:text-[#002D09]"
            }`}
          >
            <Icon size={16} aria-hidden />
            {label}
          </Link>
        );
      })}
    </nav>
  );

  return (
    <div className="min-h-screen bg-white text-[#002D09] flex flex-col">
      {/* Top bar solo en mobile */}
      <div className="md:hidden flex items-center justify-between border-b border-[#002D09]/[0.08] px-4 h-16 sticky top-0 bg-white z-40">
        <div className="flex items-center gap-2.5 min-w-0">
          <TenantBadge size="w-7 h-7" />
          <span className="text-sm font-semibold truncate">{tenant.name}</span>
        </div>
        <button
          onClick={() => setMobileOpen((v) => !v)}
          aria-label={mobileOpen ? "Cerrar menú" : "Abrir menú"}
          className="p-1.5 shrink-0"
        >
          {mobileOpen ? <X size={22} aria-hidden /> : <Menu size={22} aria-hidden />}
        </button>
      </div>

      {/* Menú desplegable en mobile */}
      {mobileOpen && (
        <div className="md:hidden border-b border-[#002D09]/[0.08] px-4 py-3 sticky top-16 bg-white z-30">
          <NavLinks onNavigate={() => setMobileOpen(false)} />
        </div>
      )}

      <div className="grid md:grid-cols-[240px_1fr] flex-1">
        {/* Sidebar fija, solo en desktop */}
        <aside className="hidden md:flex border-r border-[#002D09]/[0.08] p-5 flex-col gap-6">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={LOGO} alt="Zertoo" className="h-7 w-auto" />

          <div className="flex items-center gap-2.5 px-1">
            <TenantBadge />
            <span className="text-sm font-semibold truncate">{tenant.name}</span>
          </div>

          <NavLinks />
        </aside>

        <main className="p-5 md:p-8 min-w-0">{children}</main>
      </div>

      <footer className="border-t border-[#002D09]/[0.08] px-5 md:px-8 py-5 flex flex-col sm:flex-row items-center justify-between gap-3 text-center sm:text-left">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={LOGO} alt="Zertoo" className="h-5 w-auto opacity-70" />
        <p className="text-xs text-[#343233]/50">
          © {new Date().getFullYear()} Zertoo. Todos los derechos reservados.
        </p>
      </footer>
    </div>
  );
}
