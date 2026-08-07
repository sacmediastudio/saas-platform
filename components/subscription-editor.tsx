"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const PLANS = ["STARTER", "PRO", "BUSINESS"] as const;
const STATUSES = [
  { value: "trialing", label: "En prueba" },
  { value: "active", label: "Activa" },
  { value: "past_due", label: "Pago atrasado" },
  { value: "canceled", label: "Cancelada" },
] as const;

export default function SubscriptionEditor({
  tenantId,
  initialPlan,
  initialStatus,
}: {
  tenantId: string;
  initialPlan: string;
  initialStatus: string;
}) {
  const router = useRouter();
  const [plan, setPlan] = useState(initialPlan);
  const [status, setStatus] = useState(initialStatus);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const dirty = plan !== initialPlan || status !== initialStatus;

  async function handleSave() {
    setSaving(true);
    setError(null);
    setSaved(false);
    const res = await fetch(`/api/admin/tenants/${tenantId}/subscription`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ plan, status }),
    });
    if (!res.ok) {
      setError("No se pudo guardar.");
      setSaving(false);
      return;
    }
    setSaved(true);
    setSaving(false);
    router.refresh();
    setTimeout(() => setSaved(false), 2000);
  }

  return (
    <div className="flex flex-wrap items-end gap-2">
      <label className="flex flex-col gap-1">
        <span className="text-xs text-[#343233]/60">Plan</span>
        <select
          value={plan}
          onChange={(e) => setPlan(e.target.value)}
          className="bg-white border border-[#002D09]/15 rounded-lg px-3 py-2 text-sm outline-none"
        >
          {PLANS.map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-xs text-[#343233]/60">Estado</span>
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="bg-white border border-[#002D09]/15 rounded-lg px-3 py-2 text-sm outline-none"
        >
          {STATUSES.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </select>
      </label>
      <button
        onClick={handleSave}
        disabled={!dirty || saving}
        className="text-sm font-semibold px-4 py-2 rounded-lg bg-[#E7FF00] text-[#002D09] disabled:opacity-40"
      >
        {saving ? "Guardando..." : "Guardar"}
      </button>
      {saved && <span className="text-sm text-green-700">Guardado</span>}
      {error && <span className="text-sm text-red-600">{error}</span>}
    </div>
  );
}
