"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, X, UtensilsCrossed, Calendar, Link2, Star, Settings, Blocks, CreditCard, MessageCircleQuestion, Stamp, Gift, Users, ShoppingBag, Megaphone } from "lucide-react";
import { dashboardTranslations, type DashLang } from "@/lib/i18n-dashboard";
import { DashboardLangContext } from "@/lib/dashboard-lang-context";
import type { PermissionKey } from "@/lib/permissions";

const LOGO = "/logo.svg";

type ModuleType = "RESTAURANT" | "SMALL_BUSINESS" | "SMARTLINK";

export default function DashboardShell({
  tenant,
  enabledModules,
  billingStatus,
  role,
  permissions,
  children,
}: {
  tenant: { name: string; logoUrl: string | null };
  enabledModules: ModuleType[];
  billingStatus?: "trialing" | "trial_expired" | "active" | "past_due" | "canceled";
  role: "OWNER" | "STAFF";
  // Solo importa para STAFF — un OWNER ve todo prendido sin mirar esto.
  permissions: PermissionKey[];
  children: React.ReactNode;
}) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const pathname = usePathname();

  // Igual que en el resto del sitio: el idioma se guarda en localStorage
  // bajo la misma clave que la landing/login/signup, así que si alguien
  // ya lo cambió en otra parte del sitio, el dashboard respeta esa
  // elección desde el primer momento.
  const [lang, setLangState] = useState<DashLang>("es");
  useEffect(() => {
    if (typeof window === "undefined") return;
    const stored = window.localStorage.getItem("zertoo_lang");
    setLangState(stored === "en" ? "en" : "es");
  }, []);
  function setLang(l: DashLang) {
    setLangState(l);
    if (typeof window !== "undefined") window.localStorage.setItem("zertoo_lang", l);
  }
  const t = dashboardTranslations[lang];

  const MODULE_NAV: Record<ModuleType, { href: string; label: string; icon: any; permissionKey: PermissionKey }> = {
    RESTAURANT: { href: "/dashboard/menu", label: t.nav.menu, icon: UtensilsCrossed, permissionKey: "MENU" },
    SMALL_BUSINESS: { href: "/dashboard/bookings", label: t.nav.bookings, icon: Calendar, permissionKey: "BOOKINGS" },
    SMARTLINK: { href: "/dashboard/smartlink", label: t.nav.smartlink, icon: Link2, permissionKey: "SMARTLINK" },
  };
  const MODULE_ORDER: ModuleType[] = ["RESTAURANT", "SMALL_BUSINESS", "SMARTLINK"];

  // El nav muestra un link por cada módulo activo del negocio (puede
  // ser más de uno), en un orden fijo, más las secciones comunes. Cada
  // item lleva su permissionKey — si el negocio tiene ese módulo
  // activo pero el STAFF no tiene el permiso puntual, el item de
  // todas formas aparece (para que sepa que existe) pero deshabilitado.
  const navItems: { href: string; label: string; icon: any; permissionKey: PermissionKey | null }[] = [
    ...MODULE_ORDER.filter((m) => enabledModules.includes(m)).map((m) => MODULE_NAV[m]),
    ...(enabledModules.includes("RESTAURANT")
      ? [
          { href: "/dashboard/orders", label: t.nav.orders, icon: ShoppingBag, permissionKey: "ORDERS" as const },
          { href: "/dashboard/menu-leads", label: t.nav.menuLeads, icon: Gift, permissionKey: "MENU_LEADS" as const },
        ]
      : []),
    { href: "/dashboard/reviews", label: t.nav.reviews, icon: Star, permissionKey: "REVIEWS" as const },
    { href: "/dashboard/customers", label: t.nav.customers, icon: Users, permissionKey: "CUSTOMERS" as const },
    { href: "/dashboard/faqs", label: t.nav.faqs, icon: MessageCircleQuestion, permissionKey: "FAQS" as const },
    { href: "/dashboard/promotions", label: t.nav.promotions, icon: Megaphone, permissionKey: "PROMOTIONS" as const },
    { href: "/dashboard/loyalty", label: t.nav.loyalty, icon: Stamp, permissionKey: "LOYALTY" as const },
    { href: "/dashboard/modules", label: t.nav.modules, icon: Blocks, permissionKey: "MODULES" as const },
    { href: "/dashboard/billing", label: t.nav.billing, icon: CreditCard, permissionKey: "BILLING" as const },
    { href: "/dashboard/settings", label: t.nav.settings, icon: Settings, permissionKey: "SETTINGS" as const },
    // Solo el dueño ve y administra el equipo — nunca es un permiso que
    // se pueda tildar, ni siquiera aparece deshabilitado para STAFF (ver
    // requireOwner() en lib/auth.ts: administrar staff queda afuera del
    // sistema de permisos a propósito, para que nadie se autoescale).
    ...(role === "OWNER" ? [{ href: "/dashboard/team", label: t.nav.team, icon: Users, permissionKey: null }] : []),
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

  const LangSwitch = () => (
    <div className="flex items-center rounded-full border border-[#002D09]/15 p-0.5 text-xs font-bold shrink-0">
      {(["ES", "EN"] as const).map((l) => {
        const value = l.toLowerCase() as DashLang;
        const active = lang === value;
        return (
          <button
            key={l}
            type="button"
            onClick={() => setLang(value)}
            className={`px-2 py-1 rounded-full transition-colors ${active ? "bg-[#002D09] text-white" : "text-[#343233]/60"}`}
          >
            {l}
          </button>
        );
      })}
    </div>
  );

  const NavLinks = ({ onNavigate }: { onNavigate?: () => void }) => (
    <nav className="flex flex-col gap-0.5">
      {navItems.map(({ href, label, icon: Icon, permissionKey }) => {
        const active = pathname === href;
        // El dueño siempre tiene todo prendido — el toggle solo aplica
        // a STAFF. El link sigue visible aunque esté apagado (así sabe
        // que la sección existe), pero en gris y sin poder entrar; el
        // bloqueo real pasa en el servidor (requirePagePermission), no acá.
        const enabled = role === "OWNER" || !permissionKey || permissions.includes(permissionKey);

        if (!enabled) {
          return (
            <span
              key={href}
              aria-disabled="true"
              title={t.nav.disabledHint}
              className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-medium text-[#343233]/30 cursor-not-allowed select-none"
            >
              <Icon size={16} aria-hidden />
              {label}
            </span>
          );
        }

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
    <DashboardLangContext.Provider value={{ lang, setLang, t }}>
      <div className="min-h-screen bg-[#F5F5F5] text-[#002D09] flex flex-col">
        {/* Top bar solo en mobile */}
        <div className="md:hidden flex items-center justify-between border-b border-[#002D09]/[0.08] px-4 h-16 sticky top-0 bg-white z-40">
          <div className="flex items-center gap-2.5 min-w-0">
            <TenantBadge size="w-7 h-7" />
            <span className="text-sm font-semibold truncate">{tenant.name}</span>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <LangSwitch />
            <button
              onClick={() => setMobileOpen((v) => !v)}
              aria-label={mobileOpen ? t.nav.closeMenu : t.nav.openMenu}
              className="p-1.5"
            >
              {mobileOpen ? <X size={22} aria-hidden /> : <Menu size={22} aria-hidden />}
            </button>
          </div>
        </div>

        {/* Menú desplegable en mobile */}
        {mobileOpen && (
          <div className="md:hidden border-b border-[#002D09]/[0.08] px-4 py-3 sticky top-16 bg-white z-30">
            <NavLinks onNavigate={() => setMobileOpen(false)} />
          </div>
        )}

        <div className="grid md:grid-cols-[248px_1fr] flex-1">
          {/* Sidebar fija, solo en desktop */}
          <aside className="hidden md:flex bg-white border-r border-black/[0.06] p-5 flex-col gap-7 sticky top-0 h-screen">
            <div className="flex items-center justify-between">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={LOGO} alt="Zertoo" className="h-7 w-auto" />
              <LangSwitch />
            </div>

            <div className="flex items-center gap-2.5 px-1">
              <TenantBadge />
              <span className="text-sm font-semibold truncate">{tenant.name}</span>
            </div>

            <NavLinks />
          </aside>

          <main className="p-4 sm:p-6 md:p-9 min-w-0">
            <div className="max-w-5xl flex flex-col gap-5">
              {(billingStatus === "trial_expired" || billingStatus === "past_due") && (
                <a
                  href="/dashboard/billing"
                  className="block rounded-xl px-4 py-3 text-sm font-medium bg-amber-50 text-amber-800 border border-amber-200 hover:bg-amber-100"
                >
                  {billingStatus === "trial_expired" ? t.billingBanner.trialExpired : t.billingBanner.pastDue}{" "}
                  <span className="underline">{t.billingBanner.goToBilling}</span>
                </a>
              )}
              {children}
            </div>
          </main>
        </div>

        <footer className="bg-white border-t border-black/[0.06] px-5 md:px-8 py-5 flex flex-col sm:flex-row items-center justify-between gap-3 text-center sm:text-left">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={LOGO} alt="Zertoo" className="h-5 w-auto opacity-70" />
          <p className="text-xs text-[#343233]/50">
            © {new Date().getFullYear()} Zertoo. {t.footer.rights}
          </p>
        </footer>
      </div>
    </DashboardLangContext.Provider>
  );
}
