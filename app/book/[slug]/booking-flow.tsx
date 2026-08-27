"use client";

import { useEffect, useState } from "react";
import { Mail, Phone, MapPin, Calendar } from "lucide-react";
import { formatCurrency } from "@/lib/currency";
import { getStoredLang, setStoredLang, type Lang } from "@/lib/i18n-auth";
import { publicTranslations } from "@/lib/i18n-public";
import FaqChatWidget from "@/components/faq-chat-widget";
import SmartImage from "@/components/smart-image";

interface ServiceOption {
  id: string;
  name: string;
  description: string | null;
  imageUrl: string | null;
  durationMinutes: number;
  price: number;
  staffId: string | null;
}

function toDateParam(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function todayParam() {
  return toDateParam(new Date());
}

export default function BookingFlow({
  tenantName,
  tenantSlug,
  tenantTagline,
  logoUrl,
  heroImageUrl,
  contactEmail,
  contactPhone,
  address,
  services,
  currency,
  themeBgColor,
  themeTextColor,
  buttonColor,
  buttonTextColor,
}: {
  tenantName: string;
  tenantSlug: string;
  tenantTagline: string | null;
  logoUrl: string | null;
  heroImageUrl: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  address: string | null;
  services: ServiceOption[];
  currency: string;
  themeBgColor: string;
  themeTextColor: string;
  buttonColor: string;
  buttonTextColor: string;
}) {
  const [view, setView] = useState<"list" | "book">("list");
  const [step, setStep] = useState<2 | 3>(2);
  const [service, setService] = useState<ServiceOption | null>(null);
  const [dateParam, setDateParam] = useState(todayParam());
  const [availableSlots, setAvailableSlots] = useState<string[] | null>(null);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [time, setTime] = useState<string | null>(null);
  const [customer, setCustomer] = useState({ name: "", email: "", phone: "" });
  const [status, setStatus] = useState<"idle" | "sending" | "done" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");
  // Idioma que el cliente eligió — se guarda con la cita (para saber en
  // qué idioma mandarle el recordatorio de WhatsApp después) y se
  // recuerda entre visitas, mismo helper compartido que usa el menú
  // público (antes esta página reinventaba su propio manejo de
  // localStorage a mano, y el botón de idioma no traducía NADA — solo
  // cambiaba el estado interno sin que se notara en ningún texto).
  const [lang, setLang] = useState<Lang>("es");
  useEffect(() => {
    setLang(getStoredLang());
  }, []);
  function toggleLang(l: Lang) {
    setLang(l);
    setStoredLang(l);
  }
  const t = publicTranslations[lang].booking;

  useEffect(() => {
    if (!service || view !== "book") return;
    setLoadingSlots(true);
    setTime(null);
    fetch(`/api/public/availability?slug=${tenantSlug}&serviceId=${service.id}&date=${dateParam}`)
      .then((r) => r.json())
      .then((data) => setAvailableSlots(data.slots ?? []))
      .catch(() => setAvailableSlots([]))
      .finally(() => setLoadingSlots(false));
  }, [service, dateParam, view, tenantSlug]);

  function selectService(s: ServiceOption) {
    setService(s);
    setStep(2);
    setTime(null);
    setDateParam(todayParam());
    setView("book");
  }

  function backToList() {
    setView("list");
    setService(null);
    setStep(2);
  }

  async function confirm() {
    if (!service || !time) return;
    setStatus("sending");

    const [year, month, dayNum] = dateParam.split("-").map(Number);
    const [h, m] = time.split(":").map(Number);
    const datetime = new Date(year, month - 1, dayNum, h, m, 0, 0);

    try {
      const res = await fetch("/api/bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          serviceId: service.id,
          staffId: service.staffId ?? undefined,
          customerName: customer.name,
          customerEmail: customer.email,
          customerPhone: customer.phone || undefined,
          language: lang,
          datetime: datetime.toISOString(),
        }),
      });

      if (!res.ok) {
        let message = t.createError;
        try {
          const body = await res.json();
          if (typeof body.error === "string") message = body.error;
        } catch {}
        setErrorMsg(message);
        setStatus("error");
        return;
      }
      setStatus("done");
    } catch {
      setErrorMsg(t.genericError);
      setStatus("error");
    }
  }

  const hasBgImage = Boolean(heroImageUrl);
  const hasContact = contactEmail || contactPhone || address;

  // ---------- Pantalla de éxito ----------
  if (status === "done") {
    return (
      <div
        className="max-w-md mx-auto mt-24 text-center px-6 min-h-screen"
        style={{ backgroundColor: themeBgColor, color: themeTextColor }}
      >
        <p className="text-lg font-semibold mb-2">{t.successTitle}</p>
        <p className="text-sm opacity-70">{t.successBody(customer.email)}</p>
        <a href={`/review/${tenantSlug}`} className="text-sm font-medium underline mt-6 inline-block" style={{ opacity: 0.8 }}>
          {t.leaveReviewLink}
        </a>
        <div className="flex justify-center pt-8 opacity-50">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.svg" alt="Zertoo" className="h-4 w-auto" />
        </div>
      </div>
    );
  }

  // ---------- Lista de servicios (pantalla principal) ----------
  if (view === "list") {
    return (
      <div className="relative min-h-screen" style={{ backgroundColor: themeBgColor }}>
        {hasBgImage && (
          <>
            <SmartImage src={heroImageUrl} alt="" fill priority className="object-cover" sizes="100vw" />
            <div className="absolute inset-0 bg-black/45" />
          </>
        )}

        <div
          className="relative z-10 max-w-md mx-auto min-h-screen px-6 pt-14 pb-10 flex flex-col items-center"
          style={{ color: hasBgImage ? "#ffffff" : themeTextColor }}
        >
          <div className="absolute top-4 right-4 flex items-center rounded-full border px-0.5 py-0.5 text-[11px] font-bold" style={{ borderColor: "currentColor", opacity: 0.85 }}>
            {(["es", "en"] as const).map((l) => (
              <button
                key={l}
                type="button"
                onClick={() => toggleLang(l)}
                className="px-2 py-0.5 rounded-full transition-colors"
                style={lang === l ? { backgroundColor: "currentColor", color: themeBgColor } : undefined}
              >
                {l.toUpperCase()}
              </button>
            ))}
          </div>
          {logoUrl ? (
            <SmartImage
              src={logoUrl}
              alt={tenantName}
              width={96}
              height={96}
              className="w-24 h-24 rounded-full object-cover mb-4 border-2 border-white/40"
            />
          ) : (
            <div
              className="w-24 h-24 rounded-full mb-4 flex items-center justify-center text-2xl font-semibold"
              style={{
                backgroundColor: hasBgImage ? "rgba(255,255,255,0.15)" : themeTextColor,
                color: hasBgImage ? "#ffffff" : themeBgColor,
              }}
            >
              {tenantName.charAt(0).toUpperCase()}
            </div>
          )}

          <p className="text-2xl font-bold text-center mb-1">{tenantName}</p>
          {tenantTagline && (
            <p className="text-sm text-center mb-2 max-w-[280px] leading-relaxed" style={{ opacity: hasBgImage ? 0.85 : 0.65 }}>
              {tenantTagline}
            </p>
          )}
          <p className="flex items-center gap-1.5 text-xs uppercase tracking-[0.15em] font-semibold mb-8 opacity-70">
            <Calendar size={13} aria-hidden />
            {t.bookAppointment}
          </p>

          <div className="w-full flex flex-col gap-3">
            {services.map((s) => (
              <button
                key={s.id}
                onClick={() => selectService(s)}
                className="flex items-center gap-3 w-full px-4 py-3.5 rounded-xl text-left hover:brightness-105 transition-all"
                style={{ backgroundColor: buttonColor, color: buttonTextColor }}
              >
                {s.imageUrl ? (
                  <SmartImage
                    src={s.imageUrl}
                    alt={s.name}
                    width={48}
                    height={48}
                    className="w-12 h-12 rounded-lg object-cover shrink-0"
                  />
                ) : null}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold truncate">{s.name}</p>
                  <p className="text-xs opacity-70 mt-0.5">
                    {s.durationMinutes} {t.min}
                  </p>
                  {s.description && <p className="text-xs opacity-70 mt-0.5 truncate">{s.description}</p>}
                </div>
                <span className="text-sm font-semibold shrink-0">{formatCurrency(s.price, currency)}</span>
              </button>
            ))}

            {services.length === 0 && <p className="text-sm text-center opacity-70">{t.noServices}</p>}
          </div>

          {hasContact && (
            <div className="w-full pt-10 mt-auto text-xs opacity-70 flex flex-col gap-1.5">
              {address && (
                <span className="flex items-center gap-1.5">
                  <MapPin size={13} aria-hidden /> {address}
                </span>
              )}
              {contactPhone && (
                <span className="flex items-center gap-1.5">
                  <Phone size={13} aria-hidden /> {contactPhone}
                </span>
              )}
              {contactEmail && (
                <span className="flex items-center gap-1.5">
                  <Mail size={13} aria-hidden /> {contactEmail}
                </span>
              )}
            </div>
          )}

          <div className="pt-8 opacity-50">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/logo.svg"
              alt="Zertoo"
              className="h-4 w-auto"
              style={hasBgImage ? { filter: "brightness(0) invert(1)" } : undefined}
            />
          </div>
        </div>

        <FaqChatWidget
          tenantSlug={tenantSlug}
          buttonColor={buttonColor}
          buttonTextColor={buttonTextColor}
          themeBgColor={themeBgColor}
          themeTextColor={themeTextColor}
        />
      </div>
    );
  }

  // ---------- Flujo de reserva (fecha/hora + confirmación) ----------
  return (
    <div
      className="max-w-md mx-auto min-h-screen px-5 sm:px-6 pt-10"
      style={{ backgroundColor: themeBgColor, color: themeTextColor }}
    >
      <button onClick={backToList} className="text-xs font-medium underline mb-4 opacity-70">
        {t.backToServices}
      </button>
      <p className="text-base font-semibold mb-5">{service?.name}</p>

      {step === 2 && (
        <div>
          <p className="text-sm opacity-60 mb-2.5">{t.chooseDateTime}</p>
          <input
            type="date"
            value={dateParam}
            min={todayParam()}
            onChange={(e) => setDateParam(e.target.value)}
            className="w-full px-3 py-2.5 rounded-lg border border-neutral-200 text-sm mb-3"
          />

          {loadingSlots ? (
            <p className="text-sm opacity-60 py-4 text-center">{t.searchingSlots}</p>
          ) : availableSlots && availableSlots.length > 0 ? (
            <div className="grid grid-cols-3 gap-2">
              {availableSlots.map((h) => (
                <span
                  key={h}
                  onClick={() => setTime(h)}
                  className="text-center rounded-lg py-2 text-sm cursor-pointer border font-medium transition-colors"
                  style={{
                    borderColor: time === h ? buttonColor : "#e5e5e5",
                    borderWidth: time === h ? 1.5 : 1,
                    backgroundColor: time === h ? buttonColor : "transparent",
                    color: time === h ? buttonTextColor : "inherit",
                  }}
                >
                  {h}
                </span>
              ))}
            </div>
          ) : (
            <p className="text-sm opacity-60 py-4 text-center">{t.noSlotsAvailable}</p>
          )}

          <div className="flex gap-2 mt-4">
            <button onClick={backToList} className="flex-1 py-2.5 rounded-lg border border-neutral-200 text-sm">
              {t.back}
            </button>
            <button
              disabled={!time}
              onClick={() => setStep(3)}
              className="flex-1 py-2.5 rounded-lg text-sm font-medium disabled:opacity-40"
              style={{ backgroundColor: buttonColor, color: buttonTextColor }}
            >
              {t.continueLabel}
            </button>
          </div>
        </div>
      )}

      {step === 3 && service && (
        <div>
          <p className="text-sm opacity-60 mb-2.5">{t.confirmBooking}</p>
          <div className="border border-neutral-200 rounded-lg p-3 mb-3 text-sm">
            <Row label={t.service} value={service.name} />
            <Row
              label={t.date}
              value={new Date(
                Number(dateParam.split("-")[0]),
                Number(dateParam.split("-")[1]) - 1,
                Number(dateParam.split("-")[2])
              ).toLocaleDateString(lang === "en" ? "en" : "es", { weekday: "long", day: "numeric", month: "short" })}
            />
            <Row label={t.time} value={time ?? ""} />
            <Row label={t.price} value={formatCurrency(service.price, currency)} bold />
          </div>
          <input
            placeholder={t.namePlaceholder}
            value={customer.name}
            onChange={(e) => setCustomer({ ...customer, name: e.target.value })}
            className="w-full px-3 py-2.5 rounded-lg border border-neutral-200 text-sm mb-2"
          />
          <input
            type="email"
            placeholder={t.emailPlaceholder}
            value={customer.email}
            onChange={(e) => setCustomer({ ...customer, email: e.target.value })}
            className="w-full px-3 py-2.5 rounded-lg border border-neutral-200 text-sm mb-2"
          />
          <input
            type="tel"
            placeholder={t.phonePlaceholder}
            value={customer.phone}
            onChange={(e) => setCustomer({ ...customer, phone: e.target.value })}
            className="w-full px-3 py-2.5 rounded-lg border border-neutral-200 text-sm mb-3"
          />
          {status === "error" && <p className="text-red-600 text-sm mb-2">{errorMsg}</p>}
          <div className="flex gap-2">
            <button onClick={() => setStep(2)} className="flex-1 py-2.5 rounded-lg border border-neutral-200 text-sm">
              {t.back}
            </button>
            <button
              disabled={!customer.name || !customer.email || status === "sending"}
              onClick={confirm}
              className="flex-1 py-2.5 rounded-lg text-sm font-medium disabled:opacity-40"
              style={{ backgroundColor: buttonColor, color: buttonTextColor }}
            >
              {status === "sending" ? t.sending : t.confirm}
            </button>
          </div>
        </div>
      )}

      <div className="flex justify-center py-8 opacity-50">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo.svg" alt="Zertoo" className="h-4 w-auto" />
      </div>
    </div>
  );
}

function Row({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <div className="flex justify-between py-1">
      <span className="text-neutral-500">{label}</span>
      <span className={bold ? "font-medium" : ""}>{value}</span>
    </div>
  );
}
