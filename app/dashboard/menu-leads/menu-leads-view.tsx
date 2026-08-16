"use client";

import { useState } from "react";
import { Gift, Check, Search } from "lucide-react";
import DashboardCard from "@/components/dashboard-card";

interface Lead {
  id: string;
  name: string;
  email: string;
  phone: string;
  claimCode: string;
  redeemedAt: string | null;
}

export default function MenuLeadsView({
  initialEnabled,
  initialButtonLabel,
  initialRewardText,
  initialLeads,
}: {
  initialEnabled: boolean;
  initialButtonLabel: string;
  initialRewardText: string;
  initialLeads: Lead[];
}) {
  const [enabled, setEnabled] = useState(initialEnabled);
  const [buttonLabel, setButtonLabel] = useState(initialButtonLabel);
  const [rewardText, setRewardText] = useState(initialRewardText);
  const [leads, setLeads] = useState(initialLeads);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const [codeInput, setCodeInput] = useState("");
  const [redeemMsg, setRedeemMsg] = useState<{ type: "ok" | "error"; text: string } | null>(null);
  const [redeeming, setRedeeming] = useState(false);

  async function handleSave() {
    setSaving(true);
    setSaved(false);
    const res = await fetch("/api/tenant/menu-leads", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ enabled, buttonLabel, rewardText }),
    });
    if (res.ok) {
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    }
    setSaving(false);
  }

  async function handleRedeemByCode(e: React.FormEvent) {
    e.preventDefault();
    setRedeeming(true);
    setRedeemMsg(null);
    try {
      const res = await fetch("/api/tenant/menu-leads/redeem-by-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: codeInput }),
      });
      const body = await res.json();
      if (!res.ok) {
        setRedeemMsg({ type: "error", text: body.error ?? "No se pudo canjear" });
      } else {
        setRedeemMsg({ type: "ok", text: `¡Canjeado! (${body.lead.name})` });
        setLeads((prev) => prev.map((l) => (l.id === body.lead.id ? body.lead : l)));
        setCodeInput("");
      }
    } catch {
      setRedeemMsg({ type: "error", text: "No se pudo conectar con el servidor" });
    }
    setRedeeming(false);
  }

  return (
    <div className="flex flex-col gap-5">
      <DashboardCard>
        <h1 className="text-xl font-semibold mb-1 flex items-center gap-2">
          <Gift size={20} aria-hidden />
          Premio en el menú
        </h1>
        <p className="text-sm text-[#343233]/70 mb-6">
          Un botón al final de tu menú público invita al cliente a dejar su nombre, correo y
          WhatsApp a cambio de un premio — le llega un código de canje por WhatsApp al instante.
        </p>

        <label className="flex items-center gap-3 mb-4">
          <input
            type="checkbox"
            checked={enabled}
            onChange={(e) => setEnabled(e.target.checked)}
            className="w-4 h-4 accent-[#E7FF00]"
          />
          <span className="text-sm font-medium">Activar en el menú público</span>
        </label>

        {enabled && (
          <>
            <label className="flex items-center gap-3 mb-3">
              <span className="text-sm w-40 shrink-0">Texto del botón</span>
              <input
                value={buttonLabel}
                onChange={(e) => setButtonLabel(e.target.value)}
                placeholder="Postre gratis 🎁"
                className="flex-1 bg-[#F7F8F4] border border-[#002D09]/15 rounded-lg px-3 py-1.5 text-sm outline-none"
              />
            </label>
            <label className="flex items-start gap-3 mb-4">
              <span className="text-sm w-40 shrink-0 pt-1.5">Premio (para el mensaje)</span>
              <input
                value={rewardText}
                onChange={(e) => setRewardText(e.target.value)}
                placeholder="un postre gratis en tu próxima visita"
                className="flex-1 bg-[#F7F8F4] border border-[#002D09]/15 rounded-lg px-3 py-1.5 text-sm outline-none"
              />
            </label>
          </>
        )}

        <div className="flex items-center gap-3">
          <button
            onClick={handleSave}
            disabled={saving}
            className="text-sm font-semibold px-4 h-9 rounded-lg bg-[#E7FF00] text-[#002D09] hover:brightness-105 disabled:opacity-50"
          >
            {saving ? "Guardando..." : "Guardar"}
          </button>
          {saved && (
            <span className="flex items-center gap-1 text-sm text-green-700">
              <Check size={14} aria-hidden /> Guardado
            </span>
          )}
        </div>
      </DashboardCard>

      {enabled && (
        <>
          <DashboardCard>
            <h2 className="text-sm font-semibold mb-3">Canjear un código</h2>
            <form onSubmit={handleRedeemByCode} className="flex gap-2">
              <input
                value={codeInput}
                onChange={(e) => setCodeInput(e.target.value.toUpperCase())}
                placeholder="Código, ej. K7XM2P"
                className="flex-1 bg-[#F7F8F4] border border-[#002D09]/15 rounded-lg px-3 py-2 text-sm outline-none uppercase tracking-wider"
              />
              <button
                type="submit"
                disabled={redeeming || !codeInput}
                className="flex items-center gap-1.5 text-sm font-medium px-4 rounded-lg bg-[#E7FF00] text-[#002D09] hover:brightness-105 disabled:opacity-50"
              >
                <Search size={15} aria-hidden />
                Canjear
              </button>
            </form>
            {redeemMsg && (
              <p className={`text-sm mt-2 ${redeemMsg.type === "ok" ? "text-green-700" : "text-red-600"}`}>
                {redeemMsg.text}
              </p>
            )}
          </DashboardCard>

          <DashboardCard>
            <h2 className="text-sm font-semibold mb-3">Todos los códigos ({leads.length})</h2>
            {leads.length === 0 && (
              <p className="text-sm text-[#343233]/60">Todavía no hay ningún código reclamado.</p>
            )}
            <div className="border border-[#002D09]/10 rounded-lg overflow-hidden divide-y divide-[#002D09]/10">
              {leads.map((l) => (
                <div key={l.id} className="flex flex-wrap items-center gap-3 px-4 py-2.5">
                  <div className="flex-1 min-w-[160px]">
                    <p className="text-sm font-medium">{l.name}</p>
                    <p className="text-xs text-[#343233]/60">
                      {l.email} · {l.phone}
                    </p>
                  </div>
                  <span className="text-xs font-mono font-bold tracking-wider bg-[#F7F8F4] px-2 py-1 rounded shrink-0">
                    {l.claimCode}
                  </span>
                  <span
                    className={`text-xs px-2 py-1 rounded-md font-medium shrink-0 ${
                      l.redeemedAt ? "bg-green-50 text-green-700" : "bg-amber-50 text-amber-700"
                    }`}
                  >
                    {l.redeemedAt ? "Canjeado" : "Pendiente"}
                  </span>
                </div>
              ))}
            </div>
          </DashboardCard>
        </>
      )}
    </div>
  );
}
