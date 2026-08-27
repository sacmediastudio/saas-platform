"use client";

import { useState } from "react";
import { Sparkles, Star } from "lucide-react";
import DashboardCard from "@/components/dashboard-card";

interface Tenant {
  id: string;
  name: string;
  slug: string;
  logoUrl: string | null;
  nowCategory: string | null;
  nowFeatured: boolean;
}

// Misma lista que en /dashboard/settings y en el proyecto de Zertoo Eats.
const NOW_CATEGORY_LABELS: Record<string, string> = {
  ITALIAN: "Italiana",
  FRENCH: "Francesa",
  INTERNATIONAL: "Internacional",
  ASIAN: "Asiática",
  CRIOLLA: "Criolla",
  STEAKHOUSE: "Steakhouse",
  SEAFOOD: "Mariscos",
  FAST_FOOD: "Comida rápida",
  CAFE_DESSERTS: "Café y postres",
  PIZZERIA: "Pizzería",
  SUSHI: "Sushi",
  BAR_PUB: "Bar",
  VEGETARIAN: "Vegetariana",
};

export default function NowFeaturedView({ tenants: initialTenants }: { tenants: Tenant[] }) {
  const [tenants, setTenants] = useState(initialTenants);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const featuredCount = tenants.filter((t) => t.nowFeatured).length;

  async function toggleFeatured(tenant: Tenant) {
    setBusyId(tenant.id);
    setError(null);
    const nextValue = !tenant.nowFeatured;

    const res = await fetch(`/api/admin/tenants/${tenant.id}/now-featured`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nowFeatured: nextValue }),
    });

    if (res.ok) {
      setTenants((prev) =>
        prev
          .map((t) => (t.id === tenant.id ? { ...t, nowFeatured: nextValue } : t))
          .sort((a, b) => Number(b.nowFeatured) - Number(a.nowFeatured) || a.name.localeCompare(b.name))
      );
    } else {
      setError("No se pudo actualizar — intentá de nuevo.");
    }
    setBusyId(null);
  }

  return (
    <div className="flex flex-col gap-5">
      <DashboardCard>
        <h1 className="text-xl font-semibold mb-1 flex items-center gap-2">
          <Sparkles size={20} aria-hidden />
          Zertoo Eats — Destacados
        </h1>
        <p className="text-sm text-[#343233]/70 mb-6">
          Negocios que activaron su aparición en Zertoo Eats — marcá cuáles querés que salgan en
          "Destacados" ({featuredCount} destacados de {tenants.length}).
        </p>

        {error && <p className="text-red-600 text-sm mb-3">{error}</p>}

        {tenants.length === 0 && (
          <p className="text-sm text-[#343233]/60">
            Todavía ningún negocio activó su aparición en Zertoo Eats desde su dashboard.
          </p>
        )}

        <div className="border border-[#002D09]/10 rounded-lg overflow-hidden divide-y divide-[#002D09]/10">
          {tenants.map((t) => (
            <div key={t.id} className="flex items-center gap-3 px-4 py-3">
              {t.logoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={t.logoUrl} alt={t.name} className="w-10 h-10 rounded-lg object-cover shrink-0" />
              ) : (
                <div className="w-10 h-10 rounded-lg bg-[#002D09] text-white flex items-center justify-center text-sm font-bold shrink-0">
                  {t.name.charAt(0).toUpperCase()}
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium">{t.name}</p>
                {t.nowCategory && (
                  <p className="text-xs text-[#343233]/60">{NOW_CATEGORY_LABELS[t.nowCategory] ?? t.nowCategory}</p>
                )}
              </div>
              <button
                onClick={() => toggleFeatured(t)}
                disabled={busyId === t.id}
                className={`flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-md shrink-0 disabled:opacity-50 ${
                  t.nowFeatured
                    ? "bg-[#E7FF00] text-[#002D09]"
                    : "border border-[#002D09]/15 hover:bg-[#F7F8F4]"
                }`}
              >
                <Star size={13} className={t.nowFeatured ? "fill-current" : ""} aria-hidden />
                {t.nowFeatured ? "Destacado" : "Destacar"}
              </button>
            </div>
          ))}
        </div>
      </DashboardCard>
    </div>
  );
}
