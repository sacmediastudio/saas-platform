"use client";

import { useState } from "react";
import { Plus, Pencil, Trash2, X, Megaphone } from "lucide-react";
import DashboardCard from "@/components/dashboard-card";
import { useDashboardLang } from "@/lib/dashboard-lang-context";

interface Promotion {
  id: string;
  kind: "PROMO" | "SPECIAL";
  title: string;
  description: string | null;
  imageUrl: string | null;
  active: boolean;
  startsAt: string | null;
  endsAt: string | null;
  createdAt: string;
}

export default function PromotionsView({ initialPromotions }: { initialPromotions: Promotion[] }) {
  const { t } = useDashboardLang();
  const [promotions, setPromotions] = useState(initialPromotions);
  const [modal, setModal] = useState<{ mode: "create" | "edit"; promo?: Promotion } | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  async function toggleActive(promo: Promotion) {
    setBusy(promo.id);
    const prev = promotions;
    setPromotions((list) => list.map((p) => (p.id === promo.id ? { ...p, active: !p.active } : p)));
    const res = await fetch(`/api/promotions/${promo.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ active: !promo.active }),
    });
    if (!res.ok) setPromotions(prev);
    setBusy(null);
  }

  async function deletePromo(promo: Promotion) {
    if (!confirm(t.promotions.confirmDelete(promo.title))) return;
    setBusy(promo.id);
    const res = await fetch(`/api/promotions/${promo.id}`, { method: "DELETE" });
    if (res.ok) setPromotions((list) => list.filter((p) => p.id !== promo.id));
    setBusy(null);
  }

  return (
    <div>
      <DashboardCard>
        <div className="flex flex-wrap items-start justify-between gap-3 mb-1">
          <div>
            <h1 className="text-xl font-semibold flex items-center gap-2">
              <Megaphone size={20} aria-hidden />
              {t.promotions.title}
            </h1>
            <p className="text-sm text-[#343233]/70 mt-1">{t.promotions.subtitle}</p>
          </div>
          <button
            onClick={() => setModal({ mode: "create" })}
            className="flex items-center gap-1.5 text-sm font-medium bg-[#E7FF00] text-[#002D09] px-3.5 h-9 rounded-lg hover:brightness-105"
          >
            <Plus size={16} aria-hidden />
            {t.promotions.addPromotion}
          </button>
        </div>

        {promotions.length === 0 && <p className="text-sm text-[#343233]/60 mt-6">{t.promotions.empty}</p>}

        <div className="flex flex-col gap-2 mt-6">
          {promotions.map((promo) => (
            <div key={promo.id} className="border border-[#002D09]/10 rounded-lg px-4 py-3">
              <div className="flex items-start gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span
                      className={`text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full text-white ${
                        promo.kind === "SPECIAL" ? "bg-[#E5352B]" : "bg-[#FF7A1A]"
                      }`}
                    >
                      {promo.kind === "SPECIAL" ? t.promotions.kindSpecial : t.promotions.kindPromo}
                    </span>
                    <p className="text-sm font-semibold">{promo.title}</p>
                    <span
                      className={`text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full ${
                        promo.active ? "bg-[#E7FF00] text-[#002D09]" : "bg-[#F7F8F4] text-[#343233]/50"
                      }`}
                    >
                      {promo.active ? t.promotions.active : t.promotions.inactive}
                    </span>
                  </div>
                  {promo.description && <p className="text-sm text-[#343233]/70 mt-1">{promo.description}</p>}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => toggleActive(promo)}
                    disabled={busy === promo.id}
                    className="text-xs font-medium text-[#343233]/70 hover:text-[#002D09] disabled:opacity-40"
                  >
                    {promo.active ? t.promotions.deactivate : t.promotions.activate}
                  </button>
                  <button
                    onClick={() => setModal({ mode: "edit", promo })}
                    aria-label={t.promotions.edit}
                    className="text-[#343233]/60 hover:text-[#002D09]"
                  >
                    <Pencil size={14} aria-hidden />
                  </button>
                  <button
                    onClick={() => deletePromo(promo)}
                    disabled={busy === promo.id}
                    aria-label={t.promotions.deleteLabel}
                    className="text-[#343233]/60 hover:text-red-600"
                  >
                    <Trash2 size={14} aria-hidden />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </DashboardCard>

      {modal && (
        <PromotionModal
          mode={modal.mode}
          promo={modal.promo}
          onClose={() => setModal(null)}
          onCreated={(p) => setPromotions((prev) => [p, ...prev])}
          onUpdated={(p) => setPromotions((prev) => prev.map((x) => (x.id === p.id ? p : x)))}
        />
      )}
    </div>
  );
}

function PromotionModal({
  mode,
  promo,
  onClose,
  onCreated,
  onUpdated,
}: {
  mode: "create" | "edit";
  promo?: Promotion;
  onClose: () => void;
  onCreated: (p: Promotion) => void;
  onUpdated: (p: Promotion) => void;
}) {
  const { t } = useDashboardLang();
  const [kind, setKind] = useState<"PROMO" | "SPECIAL">(promo?.kind ?? "PROMO");
  const [title, setTitle] = useState(promo?.title ?? "");
  const [description, setDescription] = useState(promo?.description ?? "");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);

    try {
      const path = mode === "create" ? "/api/promotions" : `/api/promotions/${promo!.id}`;
      const method = mode === "create" ? "POST" : "PATCH";
      const res = await fetch(path, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind, title, description: description || undefined }),
      });

      if (!res.ok) {
        let message = t.promotions.saveFailed;
        try {
          const body = await res.json();
          if (typeof body.error === "string") message = body.error;
        } catch {}
        setError(message);
        setSaving(false);
        return;
      }

      const body = await res.json();
      const saved: Promotion = body.promotion;
      if (mode === "create") onCreated(saved);
      else onUpdated(saved);
      onClose();
    } catch {
      setError(t.promotions.genericError);
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 px-4">
      <div className="bg-white border border-[#002D09]/10 rounded-xl w-full max-w-sm p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold">
            {mode === "create" ? t.promotions.addTitle : t.promotions.editTitle}
          </h2>
          <button onClick={onClose} aria-label={t.common.cancel} className="text-[#343233]/60 hover:text-[#002D09]">
            <X size={18} aria-hidden />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <span className="text-xs text-[#343233]/70">{t.promotions.kindLabel}</span>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setKind("PROMO")}
                className={`flex-1 py-2 rounded-lg text-sm font-semibold border-2 ${
                  kind === "PROMO"
                    ? "border-[#FF7A1A] bg-[#FF7A1A]/10 text-[#FF7A1A]"
                    : "border-[#002D09]/15 text-[#343233]/60"
                }`}
              >
                {t.promotions.kindPromo}
              </button>
              <button
                type="button"
                onClick={() => setKind("SPECIAL")}
                className={`flex-1 py-2 rounded-lg text-sm font-semibold border-2 ${
                  kind === "SPECIAL"
                    ? "border-[#E5352B] bg-[#E5352B]/10 text-[#E5352B]"
                    : "border-[#002D09]/15 text-[#343233]/60"
                }`}
              >
                {t.promotions.kindSpecial}
              </button>
            </div>
          </div>

          <label className="flex flex-col gap-1">
            <span className="text-xs text-[#343233]/70">{t.promotions.promoTitle}</span>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              maxLength={120}
              placeholder={t.promotions.promoTitlePlaceholder}
              className={inputClass}
            />
          </label>

          <label className="flex flex-col gap-1">
            <span className="text-xs text-[#343233]/70">{t.promotions.description}</span>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              maxLength={500}
              rows={3}
              placeholder={t.promotions.descriptionPlaceholder}
              className={`${inputClass} resize-none`}
            />
          </label>

          {error && <p className="text-red-600 text-sm">{error}</p>}

          <div className="flex gap-2 mt-1">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2 rounded-lg border border-[#002D09]/15 text-sm hover:bg-[#F7F8F4]"
            >
              {t.common.cancel}
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex-1 py-2 rounded-lg bg-[#E7FF00] text-[#002D09] text-sm font-medium hover:brightness-105 disabled:opacity-50"
            >
              {saving ? t.promotions.saving : mode === "create" ? t.promotions.add : t.promotions.save}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

const inputClass =
  "w-full bg-[#F7F8F4] border border-[#002D09]/15 rounded-lg px-3 py-2 text-sm outline-none focus:border-[#002D09]/40";
