"use client";

import { useEffect, useState } from "react";
import { Star, Plus, Pencil, Trash2, X, ExternalLink } from "lucide-react";
import { useDashboardLang } from "@/lib/dashboard-lang-context";
import DashboardCard from "@/components/dashboard-card";

interface ReviewRow {
  id: string;
  reviewerName: string;
  rating: number;
  comment: string | null;
  status: "PUBLISHED" | "HIDDEN" | "REPORTED";
  createdAt: string;
}

type Platform = "GOOGLE" | "TRIPADVISOR" | "YELP" | "FACEBOOK" | "CUSTOM";
interface ExternalLinkRow {
  id: string;
  platform: Platform;
  label: string;
  url: string;
  enabled: boolean;
}

function platformLabels(t: ReturnType<typeof useDashboardLang>["t"]): Record<Platform, string> {
  return {
    GOOGLE: "Google",
    TRIPADVISOR: "TripAdvisor",
    YELP: "Yelp",
    FACEBOOK: "Facebook",
    CUSTOM: t.externalReviewModal.customPlatform,
  };
}

export default function ReviewsView({
  initialReviews,
  avgRating,
}: {
  initialReviews: ReviewRow[];
  avgRating: number;
}) {
  const { t } = useDashboardLang();
  const [reviews, setReviews] = useState(initialReviews);
  const [links, setLinks] = useState<ExternalLinkRow[]>([]);
  const [linksLoaded, setLinksLoaded] = useState(false);
  const [linkModal, setLinkModal] = useState<{ mode: "create" | "edit"; link?: ExternalLinkRow } | null>(null);

  useEffect(() => {
    fetch("/api/external-review-links")
      .then((r) => r.json())
      .then((data) => {
        setLinks(data.links ?? []);
        setLinksLoaded(true);
      })
      .catch(() => setLinksLoaded(true));
  }, []);

  async function toggleVisibility(review: ReviewRow) {
    const next = review.status === "PUBLISHED" ? "HIDDEN" : "PUBLISHED";
    const prev = reviews;
    setReviews((r) => r.map((x) => (x.id === review.id ? { ...x, status: next } : x)));

    const res = await fetch(`/api/reviews/${review.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: next }),
    });
    if (!res.ok) setReviews(prev);
  }

  async function toggleLinkEnabled(link: ExternalLinkRow) {
    const prev = links;
    setLinks((l) => l.map((x) => (x.id === link.id ? { ...x, enabled: !x.enabled } : x)));
    const res = await fetch(`/api/external-review-links/${link.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ enabled: !link.enabled }),
    });
    if (!res.ok) setLinks(prev);
  }

  async function deleteLink(link: ExternalLinkRow) {
    if (!confirm(`¿Borrar el link de ${platformLabels(t)[link.platform]}?`)) return;
    const res = await fetch(`/api/external-review-links/${link.id}`, { method: "DELETE" });
    if (res.ok) setLinks((l) => l.filter((x) => x.id !== link.id));
  }

  return (
    <div className="flex flex-col gap-5">
      <DashboardCard>
      <h1 className="text-xl font-semibold mb-1">{t.reviews.title}</h1>
      <p className="text-sm text-[#343233]/70 mb-8">
        {reviews.length} reseñas · {avgRating.toFixed(1)} promedio
      </p>

      {/* --- Links externos --- */}
      <div className="flex flex-wrap items-start justify-between gap-3 mb-1">
        <h2 className="text-base font-semibold">{t.reviews.externalTitle}</h2>
        <button
          onClick={() => setLinkModal({ mode: "create" })}
          className="flex items-center gap-1.5 text-sm font-medium bg-[#E7FF00] text-[#002D09] px-3.5 h-9 rounded-lg hover:brightness-105"
        >
          <Plus size={16} aria-hidden />
          {t.reviews.addLink}
        </button>
      </div>
      <p className="text-sm text-[#343233]/70 mb-4">
        Agrega tu perfil de Google, TripAdvisor, Yelp u otra plataforma — se muestran junto al
        formulario de reseña en tu página pública. Puedes activarlos y desactivarlos cuando quieras
        sin perder la configuración.
      </p>

      {linksLoaded && links.length === 0 && (
        <p className="text-sm text-[#343233]/60 mb-8">Todavía no agregaste ningún link externo.</p>
      )}

      {links.length > 0 && (
        <div className="border border-[#002D09]/10 rounded-lg overflow-hidden divide-y divide-[#002D09]/10 mb-8">
          {links.map((link) => (
            <div key={link.id} className="flex flex-wrap items-center gap-3 px-3.5 py-2.5">
              <div className="flex-1 min-w-[160px]">
                <p className="text-sm font-medium flex items-center gap-1.5">
                  {link.label}
                  {!link.enabled && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#F7F8F4] text-[#343233]/60 font-normal">
                      Desactivado
                    </span>
                  )}
                </p>
                <a
                  href={link.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-[#343233]/60 hover:text-[#002D09] flex items-center gap-1 truncate"
                >
                  <ExternalLink size={11} aria-hidden />
                  {link.url}
                </a>
              </div>
              <span className="text-xs px-2 py-1 rounded-md bg-[#F7F8F4] shrink-0">
                {platformLabels(t)[link.platform]}
              </span>
              <button
                onClick={() => toggleLinkEnabled(link)}
                className={`text-xs px-2.5 py-1.5 rounded-md font-medium shrink-0 ${
                  link.enabled ? "bg-[#F7F8F4] text-[#002D09]" : "bg-[#E7FF00] text-[#002D09]"
                }`}
              >
                {link.enabled ? "Desactivar" : "Activar"}
              </button>
              <button
                onClick={() => setLinkModal({ mode: "edit", link })}
                aria-label={`Editar link de ${link.label}`}
                className="text-[#343233]/60 hover:text-[#002D09] shrink-0"
              >
                <Pencil size={15} aria-hidden />
              </button>
              <button
                onClick={() => deleteLink(link)}
                aria-label={`Borrar link de ${link.label}`}
                className="text-[#343233]/60 hover:text-red-600 shrink-0"
              >
                <Trash2 size={15} aria-hidden />
              </button>
            </div>
          ))}
        </div>
      )}
      </DashboardCard>

      <DashboardCard>
      {/* --- Reseñas internas --- */}
      <h2 className="text-base font-semibold mb-4">{t.reviews.receivedTitle}</h2>

      {reviews.length === 0 && <p className="text-sm text-[#343233]/60">Todavía no tienes reseñas.</p>}

      <div className="flex flex-col gap-2.5">
        {reviews.map((r) => (
          <div key={r.id} className="border border-[#002D09]/10 rounded-lg p-3.5">
            <div className="flex justify-between items-start">
              <div>
                <p className="font-medium text-sm">{r.reviewerName}</p>
                <div className="flex items-center gap-0.5 my-1">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Star
                      key={i}
                      size={13}
                      className={i < r.rating ? "fill-amber-400 text-amber-400" : "text-[#343233]/20"}
                      aria-hidden
                    />
                  ))}
                </div>
              </div>
              <button
                onClick={() => toggleVisibility(r)}
                className="text-xs px-2.5 py-1 rounded-md border border-[#002D09]/15 hover:bg-[#F7F8F4] shrink-0"
              >
                {r.status === "PUBLISHED" ? "Ocultar" : "Publicar"}
              </button>
            </div>
            {r.comment && <p className="text-sm text-[#343233]/80 mt-1">{r.comment}</p>}
          </div>
        ))}
      </div>
      </DashboardCard>

      {linkModal && (
        <ExternalLinkModal
          mode={linkModal.mode}
          link={linkModal.link}
          onClose={() => setLinkModal(null)}
          onCreated={(l) => setLinks((prev) => [...prev, l])}
          onUpdated={(l) => setLinks((prev) => prev.map((x) => (x.id === l.id ? l : x)))}
        />
      )}
    </div>
  );
}

function ExternalLinkModal({
  mode,
  link,
  onClose,
  onCreated,
  onUpdated,
}: {
  mode: "create" | "edit";
  link?: ExternalLinkRow;
  onClose: () => void;
  onCreated: (l: ExternalLinkRow) => void;
  onUpdated: (l: ExternalLinkRow) => void;
}) {
  const { t } = useDashboardLang();
  const [platform, setPlatform] = useState<Platform>(link?.platform ?? "GOOGLE");
  const [label, setLabel] = useState(link?.label ?? "");
  const [url, setUrl] = useState(link?.url ?? "");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);

    try {
      const path = mode === "create" ? "/api/external-review-links" : `/api/external-review-links/${link!.id}`;
      const method = mode === "create" ? "POST" : "PATCH";
      const res = await fetch(path, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ platform, label, url }),
      });

      if (!res.ok) {
        let message = "No se pudo guardar el link";
        try {
          const body = await res.json();
          if (typeof body.error === "string") message = body.error;
        } catch {}
        setError(message);
        setSaving(false);
        return;
      }

      const { link: saved } = await res.json();
      if (mode === "create") onCreated(saved);
      else onUpdated(saved);
      onClose();
    } catch {
      setError("No se pudo conectar con el servidor. Intenta de nuevo.");
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 px-4">
      <div className="bg-white border border-[#002D09]/10 rounded-xl w-full max-w-sm p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold">{mode === "create" ? t.externalReviewModal.titleCreate : t.externalReviewModal.titleEdit}</h2>
          <button onClick={onClose} aria-label="Cerrar" className="text-[#343233]/60 hover:text-[#002D09]">
            <X size={18} aria-hidden />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <label className="flex flex-col gap-1">
            <span className="text-xs text-[#343233]/70">{t.externalReviewModal.platform}</span>
            <select
              value={platform}
              onChange={(e) => setPlatform(e.target.value as Platform)}
              className={inputClass}
            >
              {(Object.keys(platformLabels(t)) as Platform[]).map((p) => (
                <option key={p} value={p}>
                  {platformLabels(t)[p]}
                </option>
              ))}
            </select>
          </label>

          <label className="flex flex-col gap-1">
            <span className="text-xs text-[#343233]/70">{t.externalReviewModal.buttonText}</span>
            <input
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              required
              placeholder="Déjanos una reseña en Google"
              className={inputClass}
            />
          </label>

          <label className="flex flex-col gap-1">
            <span className="text-xs text-[#343233]/70">{t.externalReviewModal.url}</span>
            <input
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              required
              placeholder="https://g.page/r/..."
              className={inputClass}
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
              {saving ? t.common.saving : mode === "create" ? t.common.add : t.common.save}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

const inputClass =
  "w-full bg-[#F7F8F4] border border-[#002D09]/15 rounded-lg px-3 py-2 text-sm outline-none focus:border-[#002D09]/40";
