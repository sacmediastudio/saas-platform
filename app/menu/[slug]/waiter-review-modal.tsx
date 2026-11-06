"use client";

import { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import DialogA11y from "@/components/use-dialog-a11y";
import type { Lang } from "@/lib/i18n-auth";

interface WaiterCard {
  id: string;
  name: string;
  photoUrl: string | null;
  alreadyRated: boolean;
}

type Step =
  | { kind: "locating" }
  | { kind: "checking" }
  | { kind: "error"; reason: string }
  | { kind: "form" }
  | { kind: "thanks" };

interface Coords {
  lat: number;
  lng: number;
  accuracy: number;
}

const COPY = {
  en: {
    title: "How was your service?",
    subtitle: "Let us know how your server did today.",
    close: "Close",
    locating: "Confirming you're at the restaurant…",
    slide: "Slide to rate",
    noteLabel: "Leave a note for the server (optional)",
    submit: "Send",
    sending: "Sending…",
    thanksTitle: "Thank you!",
    thanksBody: "Your feedback goes straight to our team.",
    already: "Already rated — thank you!",
    retry: "Try again",
    done: "Done",
    labels: ["Poor", "Fair", "Good", "Very good", "Excellent"],
    errors: {
      no_location:
        "We need your location to confirm you're at the restaurant. Allow location access and try again. If you opened this from Instagram or Facebook, open the menu in Safari or Chrome.",
      imprecise:
        "We couldn't get a precise location. Turn on precise location, or step near a window, and try again.",
      too_far: "You need to be at the restaurant to rate our team.",
      closed: "Ratings are only open while the restaurant is open.",
      disabled: "Ratings aren't available right now.",
      rate_limited: "Too many attempts. Please try again in a while.",
      already_rated: "You already rated these people recently. Thank you!",
      generic: "Something went wrong. Please try again.",
    },
  },
  es: {
    title: "¿Cómo fue tu servicio?",
    subtitle: "Cuéntanos cómo te atendió tu mesero hoy.",
    close: "Cerrar",
    locating: "Confirmando que estás en el restaurante…",
    slide: "Desliza para calificar",
    noteLabel: "Deja una nota para el mesero (opcional)",
    submit: "Enviar",
    sending: "Enviando…",
    thanksTitle: "¡Gracias!",
    thanksBody: "Tu opinión llega directo a nuestro equipo.",
    already: "Ya calificaste — ¡gracias!",
    retry: "Intentar de nuevo",
    done: "Listo",
    labels: ["Malo", "Regular", "Bueno", "Muy bueno", "Excelente"],
    errors: {
      no_location:
        "Necesitamos tu ubicación para confirmar que estás en el restaurante. Permite el acceso a la ubicación e intenta de nuevo. Si abriste esto desde Instagram o Facebook, abre el menú en Safari o Chrome.",
      imprecise:
        "No pudimos obtener una ubicación precisa. Activa la ubicación precisa, o acércate a una ventana, e intenta de nuevo.",
      too_far: "Debes estar en el restaurante para calificar a nuestro equipo.",
      closed: "Las calificaciones solo están abiertas mientras el restaurante está abierto.",
      disabled: "Las calificaciones no están disponibles por ahora.",
      rate_limited: "Demasiados intentos. Intenta de nuevo en un rato.",
      already_rated: "Ya calificaste a estas personas hace poco. ¡Gracias!",
      generic: "Algo salió mal. Intenta de nuevo.",
    },
  },
} as const;

// Id anónimo y estable del dispositivo: solo sirve para limitar una
// reseña por mesero cada 12 horas. El servidor nunca lo guarda crudo.
function getDeviceId(): string {
  const fallback = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
  try {
    let id = window.localStorage.getItem("zertoo_device_id");
    if (!id) {
      id = typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : fallback();
      window.localStorage.setItem("zertoo_device_id", id);
    }
    return id;
  } catch {
    return fallback();
  }
}

function labelFor(rating: number, labels: readonly string[]): string {
  // 1–1.5 Poor, 2–2.5 Fair, 3–3.5 Good, 4–4.5 Very good, 5 Excellent
  return labels[Math.min(4, Math.max(0, Math.floor(rating) - 1))];
}

export default function WaiterReviewModal({
  slug,
  lang,
  accent,
  accentText,
  onClose,
}: {
  slug: string;
  lang: Lang;
  accent: string;
  accentText: string;
  onClose: () => void;
}) {
  const c = COPY[lang === "es" ? "es" : "en"];
  const [step, setStep] = useState<Step>({ kind: "locating" });
  const [waiters, setWaiters] = useState<WaiterCard[]>([]);
  const [ratings, setRatings] = useState<Record<string, number>>({});
  const [note, setNote] = useState("");
  const [sending, setSending] = useState(false);
  const coordsRef = useRef<Coords | null>(null);
  const deviceIdRef = useRef<string>("");
  const runRef = useRef(0);

  function errorText(reason: string): string {
    const errors = c.errors as Record<string, string>;
    return errors[reason] ?? errors.generic;
  }

  function start() {
    const run = ++runRef.current;
    deviceIdRef.current = deviceIdRef.current || getDeviceId();
    setStep({ kind: "locating" });

    if (!navigator.geolocation) {
      setStep({ kind: "error", reason: "no_location" });
      return;
    }
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        if (run !== runRef.current) return;
        const coords = { lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy: pos.coords.accuracy };
        coordsRef.current = coords;
        setStep({ kind: "checking" });
        try {
          const res = await fetch("/api/public/waiter-reviews/verify", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ slug, deviceId: deviceIdRef.current, ...coords }),
          });
          const data = await res.json().catch(() => ({}));
          if (run !== runRef.current) return;
          if (!data.ok) {
            setStep({ kind: "error", reason: typeof data.reason === "string" ? data.reason : "generic" });
            return;
          }
          setWaiters(data.waiters);
          setStep({ kind: "form" });
        } catch {
          if (run === runRef.current) setStep({ kind: "error", reason: "generic" });
        }
      },
      () => {
        if (run === runRef.current) setStep({ kind: "error", reason: "no_location" });
      },
      { enableHighAccuracy: true, timeout: 20_000, maximumAge: 30_000 }
    );
  }

  useEffect(() => {
    start();
    return () => {
      runRef.current++;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // El valor solo cuenta cuando la persona toca el deslizador — así un
  // mesero que no la atendió no recibe un puntaje "por defecto".
  function touch(id: string, value: number) {
    setRatings((prev) => ({ ...prev, [id]: value }));
  }

  async function submit() {
    const coords = coordsRef.current;
    const entries = Object.entries(ratings);
    if (!coords || entries.length === 0) return;
    setSending(true);
    try {
      const res = await fetch("/api/public/waiter-reviews/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          slug,
          deviceId: deviceIdRef.current,
          ...coords,
          note: note.trim() || undefined,
          ratings: entries.map(([waiterId, rating]) => ({ waiterId, rating })),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (data.ok) setStep({ kind: "thanks" });
      else setStep({ kind: "error", reason: typeof data.reason === "string" ? data.reason : "generic" });
    } catch {
      setStep({ kind: "error", reason: "generic" });
    } finally {
      setSending(false);
    }
  }

  const retryable = step.kind === "error" && ["no_location", "imprecise", "too_far", "generic", "rate_limited"].includes(step.reason);
  const ratedCount = Object.keys(ratings).length;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 sm:items-center" onClick={onClose}>
      <div
        className="relative max-h-[92vh] w-full overflow-y-auto rounded-t-3xl bg-white p-6 text-neutral-800 sm:max-w-md sm:rounded-3xl"
        onClick={(e) => e.stopPropagation()}
      >
        <DialogA11y onClose={onClose} label={c.title} />
        <button
          type="button"
          onClick={onClose}
          aria-label={c.close}
          className="absolute right-4 top-4 flex h-8 w-8 items-center justify-center rounded-full bg-neutral-100 text-neutral-600"
        >
          <X size={16} aria-hidden />
        </button>

        {(step.kind === "locating" || step.kind === "checking") && (
          <div className="flex flex-col items-center gap-4 py-12 text-center" role="status">
            <span className="h-8 w-8 animate-spin rounded-full border-2 border-neutral-200" style={{ borderTopColor: accent }} aria-hidden />
            <p className="text-sm text-neutral-600">{c.locating}</p>
          </div>
        )}

        {step.kind === "error" && (
          <div className="py-8 text-center" role="alert">
            <p className="text-sm leading-relaxed text-neutral-700">{errorText(step.reason)}</p>
            <div className="mt-6 flex flex-col items-center gap-2">
              {retryable && (
                <button
                  type="button"
                  onClick={start}
                  className="rounded-full px-6 py-2.5 text-sm font-semibold"
                  style={{ backgroundColor: accent, color: accentText }}
                >
                  {c.retry}
                </button>
              )}
              <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-neutral-500">
                {c.close}
              </button>
            </div>
          </div>
        )}

        {step.kind === "thanks" && (
          <div className="py-10 text-center">
            <p className="text-2xl font-extrabold">{c.thanksTitle}</p>
            <p className="mt-2 text-sm text-neutral-600">{c.thanksBody}</p>
            <button
              type="button"
              onClick={onClose}
              className="mt-6 rounded-full px-8 py-2.5 text-sm font-semibold"
              style={{ backgroundColor: accent, color: accentText }}
            >
              {c.done}
            </button>
          </div>
        )}

        {step.kind === "form" && (
          <>
            <h2 className="pr-10 text-2xl font-extrabold leading-tight">{c.title}</h2>
            <p className="mt-1 text-sm text-neutral-500">{c.subtitle}</p>

            <ul className="mt-5 flex flex-col gap-5">
              {waiters.map((w) => {
                const value = ratings[w.id];
                const touched = value !== undefined;
                return (
                  <li key={w.id} className={`flex items-center gap-4 ${w.alreadyRated ? "opacity-50" : ""}`}>
                    {w.photoUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={w.photoUrl} alt="" className="h-16 w-16 shrink-0 rounded-full object-cover" />
                    ) : (
                      <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-neutral-100 text-xl font-bold text-neutral-400">
                        {w.name.charAt(0).toUpperCase()}
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-baseline justify-between gap-2">
                        <p className="truncate text-lg font-bold">{w.name}</p>
                        {w.alreadyRated ? (
                          <span className="shrink-0 text-xs text-neutral-500">{c.already}</span>
                        ) : (
                          <span
                            className="shrink-0 rounded-md px-2 py-0.5 text-xs font-semibold"
                            style={
                              touched
                                ? { backgroundColor: `color-mix(in srgb, ${accent} 15%, white)`, color: "#1f2937" }
                                : { color: "#9ca3af" }
                            }
                          >
                            {touched ? `${labelFor(value, c.labels)} / ${value.toFixed(1)}` : c.slide}
                          </span>
                        )}
                      </div>
                      <input
                        type="range"
                        min={1}
                        max={5}
                        step={0.5}
                        defaultValue={3}
                        disabled={w.alreadyRated}
                        aria-label={w.name}
                        aria-valuetext={touched ? `${value.toFixed(1)} / 5` : c.slide}
                        onClick={(e) => {
                          if (!touched) touch(w.id, Number((e.currentTarget as HTMLInputElement).value));
                        }}
                        onKeyDown={(e) => {
                          if (!touched) touch(w.id, Number((e.currentTarget as HTMLInputElement).value));
                        }}
                        onChange={(e) => touch(w.id, Number(e.target.value))}
                        className="mt-3 h-6 w-full cursor-pointer"
                        style={{ accentColor: accent, opacity: touched ? 1 : 0.45 }}
                      />
                    </div>
                  </li>
                );
              })}
            </ul>

            <label className="mt-6 block">
              <span className="text-sm text-neutral-600">{c.noteLabel}</span>
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                maxLength={500}
                rows={3}
                className="mt-2 w-full resize-none rounded-2xl bg-neutral-100 p-3 text-sm outline-none"
              />
            </label>

            <button
              type="button"
              onClick={submit}
              disabled={sending || ratedCount === 0}
              className="mt-5 w-full rounded-full py-3 text-sm font-semibold transition-opacity disabled:opacity-40"
              style={{ backgroundColor: accent, color: accentText }}
            >
              {sending ? c.sending : c.submit}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
