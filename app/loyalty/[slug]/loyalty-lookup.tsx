"use client";

import { useEffect, useState } from "react";
import { Stamp, Gift } from "lucide-react";
import { getStoredLang, setStoredLang, type Lang } from "@/lib/i18n-auth";
import { publicTranslations } from "@/lib/i18n-public";
import LoyaltyStampProgress from "@/components/loyalty-stamp-progress";

export default function LoyaltyLookup({ slug }: { slug: string }) {
  const [email, setEmail] = useState("");
  const [result, setResult] = useState<{
    cardId: string | null;
    businessName: string;
    logoUrl: string | null;
    stamps: number;
    visitsNeeded: number;
    reward: string;
  } | null>(null);
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");
  const [lang, setLang] = useState<Lang>("es");
  useEffect(() => {
    setLang(getStoredLang());
  }, []);
  function toggleLang(l: Lang) {
    setLang(l);
    setStoredLang(l);
  }
  const t = publicTranslations[lang].loyalty;
  const addToWalletLabel = publicTranslations[lang].loyaltyTap.addToAppleWallet;
  const addToGoogleWalletLabel = publicTranslations[lang].loyaltyTap.addToGoogleWallet;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("loading");
    try {
      const res = await fetch(`/api/public/loyalty?slug=${slug}&email=${encodeURIComponent(email)}`);
      if (!res.ok) {
        setStatus("error");
        return;
      }
      const data = await res.json();
      setResult(data);
      setStatus("idle");
    } catch {
      setStatus("error");
    }
  }

  const hasReward = result && result.stamps >= result.visitsNeeded;

  return (
    <div className="max-w-sm mx-auto min-h-screen px-6 pt-16 flex flex-col items-center">
      <div className="w-full flex justify-end mb-4">
        <div
          className="flex items-center rounded-full border border-neutral-300 px-0.5 py-0.5 text-[11px] font-bold"
          style={{ opacity: 0.85 }}
        >
          {(["es", "en"] as const).map((l) => (
            <button
              key={l}
              type="button"
              onClick={() => toggleLang(l)}
              className={`px-2 py-0.5 rounded-full transition-colors ${lang === l ? "bg-[#002D09] text-white" : ""}`}
            >
              {l.toUpperCase()}
            </button>
          ))}
        </div>
      </div>

      <Stamp size={32} className="mb-4 opacity-70" aria-hidden />
      <h1 className="text-lg font-semibold text-center mb-1">{t.title}</h1>
      <p className="text-sm text-center opacity-60 mb-8">{t.subtitle}</p>

      <form onSubmit={handleSubmit} className="w-full flex flex-col gap-3">
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder={t.emailPlaceholder}
          required
          className="w-full px-3 py-2.5 rounded-lg border border-neutral-200 text-sm"
        />
        <button
          type="submit"
          disabled={status === "loading"}
          className="w-full py-2.5 rounded-lg bg-[#E7FF00] text-[#002D09] text-sm font-semibold disabled:opacity-50"
        >
          {status === "loading" ? t.searching : t.submit}
        </button>
      </form>

      {status === "error" && <p className="text-sm text-red-600 mt-4 text-center">{t.notFound}</p>}

      {result && (
        <div className="w-full mt-8 border border-neutral-200 rounded-xl p-5 text-center">
          {result.logoUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={result.logoUrl}
              alt={result.businessName}
              className="w-14 h-14 rounded-xl object-cover mx-auto mb-3"
            />
          )}
          <p className="text-sm opacity-60 mb-1">{result.businessName}</p>
          <p className="text-3xl font-extrabold mb-1">
            {result.stamps} / {result.visitsNeeded}
          </p>
          <p className="text-sm opacity-60 mb-4">{t.stamps}</p>

          <div className="mb-4">
            <LoyaltyStampProgress stamps={result.stamps} visitsNeeded={result.visitsNeeded} />
          </div>

          {hasReward ? (
            <div className="flex flex-col items-center gap-1.5 text-sm font-semibold bg-[#E7FF00] text-[#002D09] rounded-lg py-3 px-3">
              <Gift size={18} aria-hidden />
              <span>
                {t.won} {result.reward}
              </span>
            </div>
          ) : (
            <p className="text-xs opacity-60">{t.missingVisits(result.visitsNeeded - result.stamps, result.reward)}</p>
          )}

          {result.cardId && (
            <>
              <a
                href={`/api/public/loyalty/${result.cardId}/apple-pass`}
                className="w-full mt-4 py-2.5 rounded-lg border border-neutral-300 text-sm font-semibold text-center block"
              >
                {addToWalletLabel}
              </a>
              <a
                href={`/api/public/loyalty/${result.cardId}/google-pass`}
                className="w-full mt-2 py-2.5 rounded-lg border border-neutral-300 text-sm font-semibold text-center block"
              >
                {addToGoogleWalletLabel}
              </a>
            </>
          )}
        </div>
      )}
    </div>
  );
}
