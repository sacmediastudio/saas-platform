"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { UtensilsCrossed, Calendar, Link2, Check, Clock, Send } from "lucide-react";
import { useDashboardLang } from "@/lib/dashboard-lang-context";
import DashboardCard from "@/components/dashboard-card";
import { formatCurrency } from "@/lib/currency";

type ModuleType = "RESTAURANT" | "SMALL_BUSINESS" | "SMARTLINK";

// Mismos precios que en /dashboard/billing y la landing — si alguna
// vez cambian, hay que actualizarlos en los 3 lugares (no hay un solo
// archivo compartido de precios visible al cliente todavía).
const MODULE_PRICES: Record<ModuleType, number> = {
  SMARTLINK: 12.9,
  SMALL_BUSINESS: 29.9,
  RESTAURANT: 39.9,
};

const MODULES: { type: ModuleType; label: string; description: string; icon: any }[] = [
  {
    type: "RESTAURANT",
    label: "Menú",
    description: "Menú digital con fotos, categorías y platos destacados.",
    icon: UtensilsCrossed,
  },
  {
    type: "SMALL_BUSINESS",
    label: "Citas",
    description: "Agenda de citas, reservas online y bloqueo de horarios.",
    icon: Calendar,
  },
  {
    type: "SMARTLINK",
    label: "Smartlink",
    description: "Un perfil con todos tus enlaces, listo para compartir.",
    icon: Link2,
  },
];

export default function ModulesManager({
  initialEnabled,
  initialPending,
}: {
  initialEnabled: ModuleType[];
  initialPending: ModuleType[];
}) {
  const { t } = useDashboardLang();
  const router = useRouter();
  const [enabled, setEnabled] = useState<ModuleType[]>(initialEnabled);
  const [pending, setPending] = useState<ModuleType[]>(initialPending);
  const [busy, setBusy] = useState<ModuleType | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function deactivate(type: ModuleType) {
    setBusy(type);
    setError(null);
    const prev = enabled;
    setEnabled((e) => e.filter((m) => m !== type));

    const res = await fetch("/api/tenant/modules", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ module: type, enabled: false }),
    });

    if (!res.ok) {
      setEnabled(prev);
      let message = "No se pudo desactivar el módulo";
      try {
        const body = await res.json();
        if (typeof body.error === "string") message = body.error;
      } catch {}
      setError(message);
      setBusy(null);
      return;
    }

    setBusy(null);
    router.refresh(); // el nav lateral debe actualizarse
  }

  async function requestActivation(type: ModuleType) {
    setBusy(type);
    setError(null);

    const res = await fetch("/api/tenant/modules/request", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ module: type }),
    });

    if (!res.ok) {
      let message = "No se pudo enviar la solicitud";
      try {
        const body = await res.json();
        if (typeof body.error === "string") message = body.error;
      } catch {}
      setError(message);
      setBusy(null);
      return;
    }

    setPending((p) => (p.includes(type) ? p : [...p, type]));
    setBusy(null);
  }

  return (
    <div>
      <DashboardCard>
        <h1 className="text-xl font-semibold mb-1">{t.modules.title}</h1>
        <p className="text-sm text-[#343233]/70 mb-6">{t.modules.subtitle}</p>

        <div className="flex flex-col gap-3">
          {MODULES.map((m) => {
            const isEnabled = enabled.includes(m.type);
            const isPending = pending.includes(m.type);
            return (
              <div key={m.type} className="border border-[#002D09]/10 rounded-xl p-4 flex items-center gap-4">
                <div className="w-10 h-10 rounded-xl bg-[#F7F8F4] flex items-center justify-center shrink-0">
                  <m.icon size={18} className="text-[#002D09]" aria-hidden />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold">{m.label}</p>
                  <p className="text-xs text-[#343233]/60">{m.description}</p>
                  {!isEnabled && (
                    <p className="text-xs text-[#343233]/50 mt-1">
                      Recuerda que puedes activar módulos adicionales —{" "}
                      <span className="font-medium">{formatCurrency(MODULE_PRICES[m.type], "USD")}/mes</span>
                    </p>
                  )}
                </div>

                {isEnabled ? (
                  <button
                    onClick={() => deactivate(m.type)}
                    disabled={busy === m.type || enabled.length === 1}
                    title={enabled.length === 1 ? "Necesitas al menos un módulo activo" : undefined}
                    className="flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-lg shrink-0 bg-[#F7F8F4] text-[#002D09] disabled:opacity-40"
                  >
                    <Check size={13} aria-hidden />
                    Activo
                  </button>
                ) : isPending ? (
                  <span className="flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-lg shrink-0 bg-amber-50 text-amber-700">
                    <Clock size={13} aria-hidden />
                    Solicitud enviada
                  </span>
                ) : (
                  <button
                    onClick={() => requestActivation(m.type)}
                    disabled={busy === m.type}
                    className="flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-lg shrink-0 bg-[#E7FF00] text-[#002D09] disabled:opacity-40"
                  >
                    <Send size={13} aria-hidden />
                    Solicitar activación
                  </button>
                )}
              </div>
            );
          })}
        </div>

        {error && <p className="text-red-600 text-sm mt-3">{error}</p>}

        <p className="text-xs text-[#343233]/50 mt-4">
          Revisamos las solicitudes a mano y te contactamos para activarlo — así nunca te
          quedas pagando por algo que no ibas a usar de verdad.
        </p>
      </DashboardCard>
    </div>
  );
}
