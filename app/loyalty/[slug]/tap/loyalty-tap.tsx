"use client";

import { useEffect, useState } from "react";
import { Stamp, Gift } from "lucide-react";
import { getStoredLang, setStoredLang, type Lang } from "@/lib/i18n-auth";
import { publicTranslations } from "@/lib/i18n-public";
import LoyaltyStampProgress from "@/components/loyalty-stamp-progress";

interface CardInfo {
  cardId: string;
  businessName: string;
  logoUrl: string | null;
  customerName: string | null;
  stamps: number;
  visitsNeeded: number;
  reward: string;
  justEarned?: boolean;
}

type Status = "loading" | "register" | "confirm" | "confirming" | "success" | "error";

export default function LoyaltyTap({ slug }: { slug: string }) {
  const storageKey = `zertoo_loyalty_${slug}`;
  const [status, setStatus] = useState<Status>("loading");
  const [card, setCard] = useState<CardInfo | null>(null);
  const [errorMsg, setErrorMsg] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [lang, setLang] = useState<Lang>("es");
  useEffect(() => {
    setLang(getStoredLang());
  }, []);
  function toggleLang(l: Lang) {
    setLang(l);
    setStoredLang(l);
  }
  const t = publicTranslations[lang].loyaltyTap;

  useEffect(() => {
    const storedId = window.localStorage.getItem(storageKey);
    if (!storedId) {
      setStatus("register");
      return;
    }
    fetch(`/api/public/loyalty/tap?slug=${slug}&cardId=${storedId}`)
      .then((res) => {
        if (!res.ok) throw new Error("not_found");
        return res.json();
      })
      .then((data: CardInfo) => {
        setCard(data);
        setStatus("confirm");
      })
      .catch(() => {
        // El id guardado ya no sirve (se borró la tarjeta, u otro
        // motivo) — se limpia y se vuelve a registrar, en vez de
        // quedar trabado en un error.
        window.localStorage.removeItem(storageKey);
        setStatus("register");
      });
  }, [slug, storageKey]);

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault();
    setStatus("confirming");
    await submitTap({ slug, name, email });
  }

  async function handleConfirm() {
    if (!card) return;
    setStatus("confirming");
    await submitTap({ slug, cardId: card.cardId });
  }

  async function submitTap(body: Record<string, string>) {
    try {
      const res = await fetch("/api/public/loyalty/tap", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) {
        setErrorMsg(data.error === "already_stamped_today" ? t.alreadyToday : t.genericError);
        setStatus("error");
        return;
      }
      window.localStorage.setItem(storageKey, data.cardId);
      setCard(data);
      setStatus("success");
    } catch {
      setErrorMsg(t.genericError);
      setStatus("error");
    }
  }

  return (
    <div className="max-w-sm mx-auto min-h-screen px-6 pt-12 flex flex-col items-center">
      <div className="w-full flex justify-end mb-4">
        <div className="flex items-center rounded-full border border-neutral-300 px-0.5 py-0.5 text-[11px] font-bold">
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

      {card?.logoUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={card.logoUrl} alt={card.businessName} className="w-16 h-16 rounded-xl object-cover mb-4" />
      )}

      {status === "loading" && <p className="text-sm opacity-60 mt-8">{t.loading}</p>}

      {status === "register" && (
        <>
          <Stamp size={32} className="mb-4 opacity-70" aria-hidden />
          <h1 className="text-lg font-semibold text-center mb-1">{t.registerTitle}</h1>
          <p className="text-sm text-center opacity-60 mb-6">{t.registerSubtitle}</p>
          <form onSubmit={handleRegister} className="w-full flex flex-col gap-3">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t.namePlaceholder}
              required
              className="w-full px-3 py-2.5 rounded-lg border border-neutral-200 text-sm"
            />
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
              className="w-full py-2.5 rounded-lg bg-[#E7FF00] text-[#002D09] text-sm font-semibold"
            >
              {t.registerSubmit}
            </button>
          </form>
        </>
      )}

      {(status === "confirm" || status === "confirming") && card && (
        <>
          <LoyaltyStampProgress stamps={card.stamps} visitsNeeded={card.visitsNeeded} />
          <h1 className="text-lg font-semibold text-center mt-4 mb-1">
            {t.confirmQuestion(card.customerName ?? "")}
          </h1>
          <p className="text-sm text-center opacity-60 mb-6">{t.confirmSubtitle}</p>
          <button
            onClick={handleConfirm}
            disabled={status === "confirming"}
            className="w-full py-3 rounded-lg bg-[#E7FF00] text-[#002D09] text-base font-bold disabled:opacity-50"
          >
            {status === "confirming" ? t.confirming : t.confirmSubmit}
          </button>
          <a
            href={`/api/public/loyalty/${card.cardId}/apple-pass`}
            className="w-full mt-3 py-2.5 rounded-lg border border-neutral-300 text-sm font-semibold text-center block"
          >
            {t.addToAppleWallet}
          </a>
          <a
            href={`/api/public/loyalty/${card.cardId}/google-pass`}
            className="w-full mt-2 py-2.5 rounded-lg border border-neutral-300 text-sm font-semibold text-center block"
          >
            {t.addToGoogleWallet}
          </a>
        </>
      )}

      {status === "success" && card && (
        <>
          <LoyaltyStampProgress stamps={card.stamps} visitsNeeded={card.visitsNeeded} />
          {card.justEarned ? (
            <div className="w-full mt-6 border border-neutral-200 rounded-xl p-5 text-center bg-[#E7FF00]/10">
              <Gift size={28} className="mx-auto mb-2" aria-hidden />
              <p className="text-base font-bold mb-1">{t.rewardEarnedTitle}</p>
              <p className="text-sm opacity-70">{t.rewardEarnedSubtitle(card.reward)}</p>
            </div>
          ) : (
            <p className="text-base font-semibold mt-6">{t.successTitle}</p>
          )}
          <a
            href={`/api/public/loyalty/${card.cardId}/apple-pass`}
            className="w-full mt-4 py-2.5 rounded-lg border border-neutral-300 text-sm font-semibold text-center block"
          >
            {t.addToAppleWallet}
          </a>
          <a
            href={`/api/public/loyalty/${card.cardId}/google-pass`}
            className="w-full mt-2 py-2.5 rounded-lg border border-neutral-300 text-sm font-semibold text-center block"
          >
            {t.addToGoogleWallet}
          </a>
        </>
      )}

      {status === "error" && (
        <>
          <Stamp size={32} className="mb-4 opacity-40" aria-hidden />
          <p className="text-sm text-center opacity-70">{errorMsg}</p>
        </>
      )}
    </div>
  );
}
