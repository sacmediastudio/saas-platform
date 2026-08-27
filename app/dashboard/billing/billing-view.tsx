"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Check } from "lucide-react";
import { MODULE_PRICES, MODULE_ORDER, type ModuleType } from "@/lib/modules";
import { formatCurrency } from "@/lib/currency";
import DashboardCard from "@/components/dashboard-card";
import { useDashboardLang } from "@/lib/dashboard-lang-context";

interface SubscriptionData {
  status: string;
  currentPeriodEnd: string | null;
  hasStripeSubscription: boolean;
  billedModules: ModuleType[];
}

// Reutiliza los mismos nombres de módulo que ya están traducidos en el
// nav (t.nav.menu/bookings/smartlink), en vez de duplicarlos acá —
// MODULE_LABELS (en lib/modules.ts) queda fijo en español a propósito,
// porque también lo usa el panel de admin, que no es parte de esta
// traducción.
function moduleLabel(m: ModuleType, t: ReturnType<typeof useDashboardLang>["t"]): string {
  if (m === "RESTAURANT") return t.nav.menu;
  if (m === "SMALL_BUSINESS") return t.nav.bookings;
  return t.nav.smartlink;
}

export default function BillingView({
  enabledModules,
  subscription,
}: {
  enabledModules: ModuleType[];
  subscription: SubscriptionData | null;
}) {
  const { t, lang } = useDashboardLang();
  const [loading, setLoading] = useState<"checkout" | "portal" | null>(null);
  const [error, setError] = useState<string | null>(null);

  const STATUS_LABELS: Record<string, { label: string; className: string }> = {
    trialing: { label: t.billing.statusTrialing, className: "bg-amber-50 text-amber-700" },
    active: { label: t.billing.statusActive, className: "bg-green-50 text-green-700" },
    past_due: { label: t.billing.statusPastDue, className: "bg-red-50 text-red-700" },
    canceled: { label: t.billing.statusCanceled, className: "bg-[#F7F8F4] text-[#343233]/70" },
  };

  const status = subscription?.status ?? "trialing";
  const statusMeta = STATUS_LABELS[status] ?? STATUS_LABELS.trialing;

  const total = enabledModules.reduce((sum, m) => sum + MODULE_PRICES[m], 0);

  async function handleCheckout() {
    setLoading("checkout");
    setError(null);
    try {
      const res = await fetch("/api/billing/checkout", { method: "POST" });
      const body = await res.json();
      if (!res.ok) {
        setError(body?.error ?? t.billing.checkoutError);
        setLoading(null);
        return;
      }
      window.location.href = body.url;
    } catch {
      setError(t.billing.genericError);
      setLoading(null);
    }
  }

  async function handlePortal() {
    setLoading("portal");
    setError(null);
    try {
      const res = await fetch("/api/billing/portal", { method: "POST" });
      const body = await res.json();
      if (!res.ok) {
        setError(body?.error ?? t.billing.portalError);
        setLoading(null);
        return;
      }
      window.location.href = body.url;
    } catch {
      setError(t.billing.genericError);
      setLoading(null);
    }
  }

  return (
    <div className="max-w-lg">
      <DashboardCard>
      <h1 className="text-xl font-semibold mb-1">{t.billing.title}</h1>
      <p className="text-sm text-[#343233]/70 mb-6">{t.billing.subtitle}</p>

      <Suspense fallback={null}>
        <CheckoutBanner />
      </Suspense>

      <div className="border border-[#002D09]/10 rounded-lg p-5 mb-6">
        <div className="flex items-center justify-between mb-4">
          <span className="text-sm font-semibold">{t.billing.subscriptionStatus}</span>
          <span className={`text-xs px-2.5 py-1 rounded-md font-medium ${statusMeta.className}`}>
            {statusMeta.label}
          </span>
        </div>

        <div className="flex flex-col gap-2 mb-4">
          {MODULE_ORDER.filter((m) => enabledModules.includes(m)).map((m) => (
            <div key={m} className="flex items-center justify-between text-sm">
              <span className="flex items-center gap-2">
                <Check size={14} className="text-[#002D09]" aria-hidden />
                {moduleLabel(m, t)}
              </span>
              <span className="font-medium">
                {formatCurrency(MODULE_PRICES[m], "USD")}
                {t.billing.perMonth}
              </span>
            </div>
          ))}
        </div>

        <div className="flex items-center justify-between pt-3 border-t border-[#002D09]/10 mb-5">
          <span className="text-sm font-semibold">{t.billing.monthlyTotal}</span>
          <span className="text-lg font-bold">
            {formatCurrency(total, "USD")}
            {t.billing.perMonth}
          </span>
        </div>

        {subscription?.currentPeriodEnd && (
          <p className="text-xs text-[#343233]/60 mb-4">
            {status === "canceled" ? t.billing.ends : t.billing.renews}{" "}
            {new Date(subscription.currentPeriodEnd).toLocaleDateString(lang, {
              day: "numeric",
              month: "long",
              year: "numeric",
            })}
          </p>
        )}

        {error && <p className="text-red-600 text-sm mb-3">{error}</p>}

        {subscription?.hasStripeSubscription ? (
          <button
            onClick={handlePortal}
            disabled={loading !== null}
            className="w-full py-2.5 rounded-lg bg-[#E7FF00] text-[#002D09] text-sm font-semibold hover:brightness-105 disabled:opacity-50"
          >
            {loading === "portal" ? t.billing.opening : t.billing.manageBilling}
          </button>
        ) : (
          <button
            onClick={handleCheckout}
            disabled={loading !== null}
            className="w-full py-2.5 rounded-lg bg-[#E7FF00] text-[#002D09] text-sm font-semibold hover:brightness-105 disabled:opacity-50"
          >
            {loading === "checkout" ? t.billing.redirecting : t.billing.subscribe}
          </button>
        )}
      </div>

      <p className="text-xs text-[#343233]/50">
        {t.billing.footerBefore}
        <a href="/dashboard/modules" className="underline hover:text-[#002D09]">
          {t.nav.modules}
        </a>
        {t.billing.footerAfter}
      </p>
      </DashboardCard>
    </div>
  );
}

function CheckoutBanner() {
  const { t } = useDashboardLang();
  const searchParams = useSearchParams();
  const checkout = searchParams.get("checkout");
  if (checkout === "success") {
    return (
      <p className="text-sm text-green-700 bg-green-50 rounded-md px-3 py-2 mb-4">{t.billing.checkoutSuccess}</p>
    );
  }
  if (checkout === "cancelled") {
    return (
      <p className="text-sm text-[#343233]/70 bg-[#F7F8F4] rounded-md px-3 py-2 mb-4">
        {t.billing.checkoutCancelled}
      </p>
    );
  }
  return null;
}
