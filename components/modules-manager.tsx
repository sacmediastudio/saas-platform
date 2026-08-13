"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { UtensilsCrossed, Calendar, Link2, Check, Plus } from "lucide-react";
import { useDashboardLang } from "@/lib/dashboard-lang-context";
import DashboardCard from "@/components/dashboard-card";

type ModuleType = "RESTAURANT" | "SMALL_BUSINESS" | "SMARTLINK";

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

export default function ModulesManager({ initialEnabled }: { initialEnabled: ModuleType[] }) {
  const { t } = useDashboardLang();
  const router = useRouter();
  const [enabled, setEnabled] = useState<ModuleType[]>(initialEnabled);
  const [busy, setBusy] = useState<ModuleType | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function toggle(type: ModuleType, next: boolean) {
    setBusy(type);
    setError(null);
    const prev = enabled;
    setEnabled((e) => (next ? [...e, type] : e.filter((m) => m !== type)));

    const res = await fetch("/api/tenant/modules", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ module: type, enabled: next }),
    });

    if (!res.ok) {
      setEnabled(prev);
      let message = "No se pudo actualizar el módulo";
      try {
        const body = await res.json();
        if (typeof body.error === "string") message = body.error;
      } catch {}
      setError(message);
      setBusy(null);
      return;
    }

    setBusy(null);
    router.refresh(); // el nav lateral debe actualizarse con el módulo nuevo
  }

  return (
    <div>
      <DashboardCard>
      <h1 className="text-xl font-semibold mb-1">{t.modules.title}</h1>
      <p className="text-sm text-[#343233]/70 mb-6">{t.modules.subtitle}</p>

      <div className="flex flex-col gap-3">
        {MODULES.map((m) => {
          const isEnabled = enabled.includes(m.type);
          return (
            <div key={m.type} className="border border-[#002D09]/10 rounded-xl p-4 flex items-center gap-4">
              <div className="w-10 h-10 rounded-xl bg-[#F7F8F4] flex items-center justify-center shrink-0">
                <m.icon size={18} className="text-[#002D09]" aria-hidden />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold">{m.label}</p>
                <p className="text-xs text-[#343233]/60">{m.description}</p>
              </div>
              <button
                onClick={() => toggle(m.type, !isEnabled)}
                disabled={busy === m.type || (isEnabled && enabled.length === 1)}
                title={
                  isEnabled && enabled.length === 1
                    ? "Necesitas al menos un módulo activo"
                    : undefined
                }
                className={`flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-lg shrink-0 disabled:opacity-40 ${
                  isEnabled ? "bg-[#F7F8F4] text-[#002D09]" : "bg-[#E7FF00] text-[#002D09]"
                }`}
              >
                {isEnabled ? (
                  <>
                    <Check size={13} aria-hidden />
                    Activo
                  </>
                ) : (
                  <>
                    <Plus size={13} aria-hidden />
                    Activar
                  </>
                )}
              </button>
            </div>
          );
        })}
      </div>

      {error && <p className="text-red-600 text-sm mt-3">{error}</p>}
      </DashboardCard>
    </div>
  );
}
