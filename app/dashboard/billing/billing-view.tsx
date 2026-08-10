"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Check } from "lucide-react";
import { MODULE_LABELS, MODULE_PRICES, MODULE_ORDER, type ModuleType } from "@/lib/modules";
import { formatCurrency } from "@/lib/currency";

interface SubscriptionData {
  status: string;
  currentPeriodEnd: string | null;
  hasStripeSubscription: boolean;
  billedModules: ModuleType[];
}

const STATUS_LABELS: Record<string, { label: string; className: string }> = {
  trialing: { label: "En prueba", className: "bg-amber-50 text-amber-700" },
  active: { label: "Activa", className: "bg-green-50 text-green-700" },
  past_due: { label: "Pago atrasado", className: "bg-red-50 text-red-700" },
  canceled: { label: "Cancelada", className: "bg-[#F7F8F4] text-[#343233]/70" },
};

export default function BillingView({
  enabledModules,
  subscription,
}: {
  enabledModules: ModuleType[];
  subscription: SubscriptionData | null;
}) {
  const [loading, setLoading] = useState<"checkout" | "portal" | null>(null);
  const [error, setError] = useState<string | null>(null);

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
        setError(body?.error ?? "No se pudo iniciar el checkout.");
        setLoading(null);
        return;
      }
      window.location.href = body.url;
    } catch {
      setError("No se pudo conectar con el servidor. Intenta de nuevo.");
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
        setError(body?.error ?? "No se pudo abrir el portal de facturación.");
        setLoading(null);
        return;
      }
      window.location.href = body.url;
    } catch {
      setError("No se pudo conectar con el servidor. Intenta de nuevo.");
      setLoading(null);
    }
  }

  return (
    <div className="max-w-lg">
      <h1 className="text-xl font-semibold mb-1">Facturación</h1>
      <p className="text-sm text-[#343233]/70 mb-6">Tu plan se calcula según los módulos que tengas activos.</p>

      <Suspense fallback={null}>
        <CheckoutBanner />
      </Suspense>

      <div className="border border-[#002D09]/10 rounded-lg p-5 mb-6">
        <div className="flex items-center justify-between mb-4">
          <span className="text-sm font-semibold">Estado de tu suscripción</span>
          <span className={`text-xs px-2.5 py-1 rounded-md font-medium ${statusMeta.className}`}>
            {statusMeta.label}
          </span>
        </div>

        <div className="flex flex-col gap-2 mb-4">
          {MODULE_ORDER.filter((m) => enabledModules.includes(m)).map((m) => (
            <div key={m} className="flex items-center justify-between text-sm">
              <span className="flex items-center gap-2">
                <Check size={14} className="text-[#002D09]" aria-hidden />
                {MODULE_LABELS[m]}
              </span>
              <span className="font-medium">{formatCurrency(MODULE_PRICES[m], "USD")}/mes</span>
            </div>
          ))}
        </div>

        <div className="flex items-center justify-between pt-3 border-t border-[#002D09]/10 mb-5">
          <span className="text-sm font-semibold">Total mensual</span>
          <span className="text-lg font-bold">{formatCurrency(total, "USD")}/mes</span>
        </div>

        {subscription?.currentPeriodEnd && (
          <p className="text-xs text-[#343233]/60 mb-4">
            {status === "canceled" ? "Termina" : "Se renueva"} el{" "}
            {new Date(subscription.currentPeriodEnd).toLocaleDateString("es", {
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
            {loading === "portal" ? "Abriendo..." : "Gestionar facturación"}
          </button>
        ) : (
          <button
            onClick={handleCheckout}
            disabled={loading !== null}
            className="w-full py-2.5 rounded-lg bg-[#E7FF00] text-[#002D09] text-sm font-semibold hover:brightness-105 disabled:opacity-50"
          >
            {loading === "checkout" ? "Redirigiendo..." : "Suscribirse"}
          </button>
        )}
      </div>

      <p className="text-xs text-[#343233]/50">
        Si activas o desactivas un módulo en{" "}
        <a href="/dashboard/modules" className="underline hover:text-[#002D09]">
          Módulos
        </a>
        , tu próxima factura se ajusta automáticamente.
      </p>
    </div>
  );
}

function CheckoutBanner() {
  const searchParams = useSearchParams();
  const checkout = searchParams.get("checkout");
  if (checkout === "success") {
    return (
      <p className="text-sm text-green-700 bg-green-50 rounded-md px-3 py-2 mb-4">
        ¡Listo! Tu suscripción quedó activa.
      </p>
    );
  }
  if (checkout === "cancelled") {
    return (
      <p className="text-sm text-[#343233]/70 bg-[#F7F8F4] rounded-md px-3 py-2 mb-4">
        No se completó el pago. Puedes intentarlo de nuevo cuando quieras.
      </p>
    );
  }
  return null;
}
