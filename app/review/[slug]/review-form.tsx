"use client";

import { useEffect, useState } from "react";
import { Star, ExternalLink } from "lucide-react";
import { getStoredLang, setStoredLang, type Lang } from "@/lib/i18n-auth";
import { publicTranslations } from "@/lib/i18n-public";

interface TenantData {
  name: string;
  slug: string;
  logoUrl: string | null;
  themeBgColor: string;
  themeTextColor: string;
  buttonColor: string;
  buttonTextColor: string;
  menuCardColor: string;
  menuPageTextColor: string;
}
interface ExternalLinkData {
  id: string;
  platform: string;
  label: string;
  url: string;
}

export default function ReviewForm({
  tenant,
  externalLinks,
}: {
  tenant: TenantData;
  externalLinks: ExternalLinkData[];
}) {
  const [rating, setRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [reviewerName, setReviewerName] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  const [comment, setComment] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "done" | "error">("idle");
  const [error, setError] = useState<string | null>(null);
  const [lang, setLang] = useState<Lang>("es");
  useEffect(() => {
    setLang(getStoredLang());
  }, []);
  function toggleLang(l: Lang) {
    setLang(l);
    setStoredLang(l);
  }
  const t = publicTranslations[lang].review;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (rating === 0) {
      setError(t.ratingRequired);
      return;
    }
    setStatus("sending");

    try {
      const res = await fetch("/api/reviews", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tenantSlug: tenant.slug,
          reviewerName,
          customerEmail: customerEmail || undefined,
          rating,
          comment: comment || undefined,
          source: "qr",
        }),
      });

      if (!res.ok) {
        let message = t.submitError;
        try {
          const body = await res.json();
          if (typeof body.error === "string") message = body.error;
        } catch {}
        setError(message);
        setStatus("error");
        return;
      }

      setStatus("done");
    } catch {
      setError(t.genericError);
      setStatus("error");
    }
  }

  if (status === "done") {
    return (
      <div
        className="min-h-screen flex flex-col items-center justify-center px-6 text-center"
        style={{ backgroundColor: tenant.themeBgColor, color: tenant.menuPageTextColor }}
      >
        {tenant.logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={tenant.logoUrl} alt={tenant.name} className="w-16 h-16 rounded-2xl object-cover mb-5" />
        ) : (
          <div
            className="w-16 h-16 rounded-2xl mb-5 flex items-center justify-center text-xl font-semibold"
            style={{ backgroundColor: tenant.themeTextColor, color: tenant.themeBgColor }}
          >
            {tenant.name.charAt(0).toUpperCase()}
          </div>
        )}
        <div
          className="w-full max-w-sm rounded-2xl shadow-[0_4px_20px_-8px_rgba(0,0,0,0.12)] px-6 py-8 flex flex-col items-center"
          style={{ backgroundColor: tenant.menuCardColor, color: tenant.themeTextColor }}
        >
          <div className="flex items-center gap-1 mb-4">
            {Array.from({ length: 5 }).map((_, i) => (
              <Star
                key={i}
                size={22}
                className={i < rating ? "fill-amber-400 text-amber-400" : "opacity-20"}
                aria-hidden
              />
            ))}
          </div>
          <p className="text-lg font-semibold mb-2">{t.thanksTitle}</p>
          <p className="text-sm opacity-70 max-w-xs">{t.thanksBody(tenant.name)}</p>
        </div>
      </div>
    );
  }

  return (
    <div
      className="min-h-screen flex flex-col items-center px-6 pt-16 pb-10"
      style={{ backgroundColor: tenant.themeBgColor, color: tenant.menuPageTextColor }}
    >
      <div className="w-full max-w-sm">
        <div className="flex justify-end mb-3">
          <div
            className="flex items-center rounded-full border px-0.5 py-0.5 text-[11px] font-bold"
            style={{ borderColor: "currentColor", opacity: 0.85 }}
          >
            {(["es", "en"] as const).map((l) => (
              <button
                key={l}
                type="button"
                onClick={() => toggleLang(l)}
                className="px-2 py-0.5 rounded-full transition-colors"
                style={lang === l ? { backgroundColor: "currentColor", color: tenant.themeBgColor } : undefined}
              >
                {l.toUpperCase()}
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-col items-center mb-6">
          {tenant.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={tenant.logoUrl} alt={tenant.name} className="w-16 h-16 rounded-2xl object-cover" />
          ) : (
            <div
              className="w-16 h-16 rounded-2xl flex items-center justify-center text-xl font-semibold"
              style={{ backgroundColor: tenant.themeTextColor, color: tenant.themeBgColor }}
            >
              {tenant.name.charAt(0).toUpperCase()}
            </div>
          )}
        </div>

        <div
          className="rounded-2xl shadow-[0_4px_20px_-8px_rgba(0,0,0,0.12)] px-6 py-8"
          style={{ backgroundColor: tenant.menuCardColor, color: tenant.themeTextColor }}
        >
          <div className="flex flex-col items-center text-center mb-8">
            <p className="text-lg font-semibold">{t.title}</p>
            <p className="text-sm opacity-60 mt-1">{t.subtitle(tenant.name)}</p>
          </div>

          {externalLinks.length > 0 && (
            <div className="mb-8">
              <div className="flex flex-col gap-2.5">
                {externalLinks.map((link) => (
                  <a
                    key={link.id}
                    href={link.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-center gap-2 w-full py-3 rounded-xl border text-sm font-medium hover:brightness-105 transition-all"
                    style={{ borderColor: "currentColor", opacity: 1 }}
                  >
                    <ExternalLink size={14} aria-hidden />
                    {link.label}
                  </a>
                ))}
              </div>
              <div className="flex items-center gap-3 my-6 opacity-40">
                <div className="flex-1 h-px" style={{ backgroundColor: "currentColor" }} />
                <span className="text-xs">{t.orLeaveHere}</span>
                <div className="flex-1 h-px" style={{ backgroundColor: "currentColor" }} />
              </div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div className="flex items-center justify-center gap-2">
              {Array.from({ length: 5 }).map((_, i) => {
                const starValue = i + 1;
                const filled = starValue <= (hoverRating || rating);
                return (
                  <button
                    key={i}
                    type="button"
                    onClick={() => setRating(starValue)}
                    onMouseEnter={() => setHoverRating(starValue)}
                    onMouseLeave={() => setHoverRating(0)}
                    aria-label={t.starLabel(starValue)}
                    className="p-1 transition-transform hover:scale-110"
                  >
                    <Star size={32} className={filled ? "fill-amber-400 text-amber-400" : "opacity-25"} aria-hidden />
                  </button>
                );
              })}
            </div>

            <input
              value={reviewerName}
              onChange={(e) => setReviewerName(e.target.value)}
              required
              placeholder={t.namePlaceholder}
              className="w-full px-4 py-3 rounded-xl border text-sm bg-transparent outline-none"
              style={{ borderColor: "currentColor", opacity: 1 }}
            />

            <input
              type="email"
              value={customerEmail}
              onChange={(e) => setCustomerEmail(e.target.value)}
              placeholder={t.emailPlaceholder}
              className="w-full px-4 py-3 rounded-xl border text-sm bg-transparent outline-none"
              style={{ borderColor: "currentColor", opacity: 1 }}
            />

            <textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              rows={4}
              placeholder={t.commentPlaceholder}
              className="w-full px-4 py-3 rounded-xl border text-sm bg-transparent outline-none resize-none"
              style={{ borderColor: "currentColor", opacity: 1 }}
            />

            {error && <p className="text-red-500 text-sm">{error}</p>}

            <button
              type="submit"
              disabled={status === "sending"}
              className="w-full py-3 rounded-full text-sm font-semibold hover:brightness-105 transition-all disabled:opacity-50"
              style={{ backgroundColor: tenant.buttonColor, color: tenant.buttonTextColor }}
            >
              {status === "sending" ? t.sending : t.submit}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
