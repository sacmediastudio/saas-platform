"use client";

import { useState } from "react";
import { Stamp, Gift, Check } from "lucide-react";
import DashboardCard from "@/components/dashboard-card";
import { useDashboardLang } from "@/lib/dashboard-lang-context";

interface Card {
  id: string;
  customerName: string | null;
  customerEmail: string;
  stamps: number;
  rewardsRedeemed: number;
}

export default function LoyaltyView({
  initialEnabled,
  initialVisitsNeeded,
  initialReward,
  slug,
  initialCards,
}: {
  initialEnabled: boolean;
  initialVisitsNeeded: number;
  initialReward: string;
  slug: string;
  initialCards: Card[];
}) {
  const { t } = useDashboardLang();
  const [enabled, setEnabled] = useState(initialEnabled);
  const [visitsNeeded, setVisitsNeeded] = useState(initialVisitsNeeded);
  const [reward, setReward] = useState(initialReward);
  const [cards, setCards] = useState(initialCards);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [redeeming, setRedeeming] = useState<string | null>(null);

  const publicUrl = typeof window !== "undefined" ? `${window.location.origin}/loyalty/${slug}` : `/loyalty/${slug}`;

  async function handleSave() {
    setSaving(true);
    setSaved(false);
    const res = await fetch("/api/tenant/loyalty", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ enabled, visitsNeeded, reward }),
    });
    if (res.ok) {
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    }
    setSaving(false);
  }

  async function handleRedeem(card: Card) {
    if (!confirm(t.loyalty.confirmRedeem(card.customerName ?? card.customerEmail))) return;
    setRedeeming(card.id);
    const res = await fetch(`/api/tenant/loyalty/${card.id}/redeem`, { method: "POST" });
    if (res.ok) {
      const { card: updated } = await res.json();
      setCards((prev) => prev.map((c) => (c.id === card.id ? updated : c)));
    }
    setRedeeming(null);
  }

  return (
    <div className="flex flex-col gap-5">
      <DashboardCard>
        <h1 className="text-xl font-semibold mb-1 flex items-center gap-2">
          <Stamp size={20} aria-hidden />
          {t.loyalty.title}
        </h1>
        <p className="text-sm text-[#343233]/70 mb-6">{t.loyalty.subtitle}</p>

        <label className="flex items-center gap-3 mb-4">
          <input
            type="checkbox"
            checked={enabled}
            onChange={(e) => setEnabled(e.target.checked)}
            className="w-4 h-4 accent-[#E7FF00]"
          />
          <span className="text-sm font-medium">{t.loyalty.activate}</span>
        </label>

        {enabled && (
          <>
            <label className="flex items-center gap-3 mb-3">
              <span className="text-sm w-40 shrink-0">{t.loyalty.visitsForReward}</span>
              <input
                type="number"
                min="2"
                max="50"
                value={visitsNeeded}
                onChange={(e) => setVisitsNeeded(Number(e.target.value))}
                className="w-20 bg-[#F7F8F4] border border-[#002D09]/15 rounded-lg px-2.5 py-1.5 text-sm outline-none"
              />
            </label>
            <label className="flex items-start gap-3 mb-4">
              <span className="text-sm w-40 shrink-0 pt-1.5">{t.loyalty.reward}</span>
              <input
                value={reward}
                onChange={(e) => setReward(e.target.value)}
                placeholder={t.loyalty.rewardPlaceholder}
                className="flex-1 bg-[#F7F8F4] border border-[#002D09]/15 rounded-lg px-3 py-1.5 text-sm outline-none"
              />
            </label>

            <div className="flex items-center gap-2 bg-[#F7F8F4] rounded-lg px-3 py-2 mb-4">
              <span className="text-sm text-[#002D09] truncate flex-1">{publicUrl}</span>
            </div>
            <p className="text-xs text-[#343233]/60 mb-4">{t.loyalty.shareLinkHint}</p>
          </>
        )}

        <div className="flex items-center gap-3">
          <button
            onClick={handleSave}
            disabled={saving}
            className="text-sm font-semibold px-4 h-9 rounded-lg bg-[#E7FF00] text-[#002D09] hover:brightness-105 disabled:opacity-50"
          >
            {saving ? t.loyalty.saving : t.loyalty.save}
          </button>
          {saved && (
            <span className="flex items-center gap-1 text-sm text-green-700">
              <Check size={14} aria-hidden /> {t.loyalty.saved}
            </span>
          )}
        </div>
      </DashboardCard>

      {enabled && (
        <DashboardCard>
          <h2 className="text-sm font-semibold mb-3">{t.loyalty.customersWithStamps}</h2>

          {cards.length === 0 && <p className="text-sm text-[#343233]/60">{t.loyalty.noCustomersYet}</p>}

          <div className="border border-[#002D09]/10 rounded-lg overflow-hidden divide-y divide-[#002D09]/10">
            {cards.map((c) => {
              const hasReward = c.stamps >= visitsNeeded;
              return (
                <div key={c.id} className="flex flex-wrap items-center gap-3 px-4 py-2.5">
                  <div className="flex-1 min-w-[160px]">
                    <p className="text-sm font-medium">{c.customerName ?? c.customerEmail}</p>
                    <p className="text-xs text-[#343233]/60">{c.customerEmail}</p>
                  </div>
                  <span className="text-sm font-semibold shrink-0">
                    {c.stamps} / {visitsNeeded} {t.loyalty.stamps}
                  </span>
                  {hasReward ? (
                    <button
                      onClick={() => handleRedeem(c)}
                      disabled={redeeming === c.id}
                      className="flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-md bg-[#E7FF00] text-[#002D09] font-medium hover:brightness-105 shrink-0"
                    >
                      <Gift size={13} aria-hidden />
                      {t.loyalty.markRedeemed}
                    </button>
                  ) : (
                    <span className="text-xs text-[#343233]/50 shrink-0">{t.loyalty.notYet}</span>
                  )}
                </div>
              );
            })}
          </div>
        </DashboardCard>
      )}
    </div>
  );
}
