"use client";

import { useEffect, useState } from "react";
import { Mail, Phone, MapPin, Calendar } from "lucide-react";
import { formatCurrency } from "@/lib/currency";

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
  const [customer, setCustomer] = useState({ name: "", email: "" });
  const [status, setStatus] = useState<"idle" | "sending" | "done" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");

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
          datetime: datetime.toISOString(),
        }),
      });

      if (!res.ok) {
        let message = "No se pudo crear la reserva";
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
      setErrorMsg("No se pudo conectar con el servidor. Intenta de nuevo.");
      setStatus("error");
    }
  }

  const hasBgImage = Boolean(heroImageUrl);
  const hasContact = contactEmail || contactPhone || address;

  // ---------- Pantalla de éxito ----------
  if (status === "done") {
    return (
      <div
        className="max-w-sm mx-auto mt-24 text-center px-4 min-h-screen"
        style={{ backgroundColor: themeBgColor, color: themeTextColor }}
      >
        <p className="text-lg font-semibold mb-2">Reserva enviada</p>
        <p className="text-sm opacity-70">
          Te llegará una confirmación a {customer.email} cuando el negocio confirme tu cita.
        </p>
        <a href={`/review/${tenantSlug}`} className="text-sm font-medium underline mt-6 inline-block" style={{ opacity: 0.8 }}>
          ¿Ya visitaste antes? Deja tu reseña
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
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={heroImageUrl!} alt="" className="absolute inset-0 w-full h-full object-cover" />
            <div className="absolute inset-0 bg-black/45" />
          </>
        )}

        <div
          className="relative z-10 max-w-md mx-auto min-h-screen px-6 pt-14 pb-10 flex flex-col items-center"
          style={{ color: hasBgImage ? "#ffffff" : themeTextColor }}
        >
          {logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={logoUrl}
              alt={tenantName}
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

          <p className={`text-lg font-semibold text-center ${tenantTagline ? "mb-1" : "mb-2"}`}>{tenantName}</p>
          {tenantTagline && (
            <p className="text-sm text-center mb-2 max-w-[280px] leading-relaxed" style={{ opacity: hasBgImage ? 0.85 : 0.65 }}>
              {tenantTagline}
            </p>
          )}
          <p className="flex items-center gap-1.5 text-xs uppercase tracking-[0.15em] font-semibold mb-8 opacity-70">
            <Calendar size={13} aria-hidden />
            Agendar cita
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
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={s.imageUrl} alt={s.name} className="w-12 h-12 rounded-lg object-cover shrink-0" />
                ) : null}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold truncate">{s.name}</p>
                  <p className="text-xs opacity-70 mt-0.5">{s.durationMinutes} min</p>
                  {s.description && <p className="text-xs opacity-70 mt-0.5 truncate">{s.description}</p>}
                </div>
                <span className="text-sm font-semibold shrink-0">{formatCurrency(s.price, currency)}</span>
              </button>
            ))}

            {services.length === 0 && (
              <p className="text-sm text-center opacity-70">Este negocio todavía no tiene servicios activos.</p>
            )}
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
      </div>
    );
  }

  // ---------- Flujo de reserva (fecha/hora + confirmación) ----------
  return (
    <div
      className="max-w-sm mx-auto min-h-screen px-4 pt-10"
      style={{ backgroundColor: themeBgColor, color: themeTextColor }}
    >
      <button onClick={backToList} className="text-xs font-medium underline mb-4 opacity-70">
        ← Volver a servicios
      </button>
      <p className="text-base font-semibold mb-5">{service?.name}</p>

      {step === 2 && (
        <div>
          <p className="text-sm opacity-60 mb-2.5">Elige fecha y hora</p>
          <input
            type="date"
            value={dateParam}
            min={todayParam()}
            onChange={(e) => setDateParam(e.target.value)}
            className="w-full px-3 py-2.5 rounded-lg border border-neutral-200 text-sm mb-3"
          />

          {loadingSlots ? (
            <p className="text-sm opacity-60 py-4 text-center">Buscando horarios...</p>
          ) : availableSlots && availableSlots.length > 0 ? (
            <div className="grid grid-cols-3 gap-2">
              {availableSlots.map((h) => (
                <span
                  key={h}
                  onClick={() => setTime(h)}
                  className="text-center rounded-lg py-2 text-sm cursor-pointer border"
                  style={{
                    borderColor: time === h ? buttonColor : "#e5e5e5",
                    borderWidth: time === h ? 1.5 : 1,
                  }}
                >
                  {h}
                </span>
              ))}
            </div>
          ) : (
            <p className="text-sm opacity-60 py-4 text-center">
              No hay horarios disponibles ese día. Prueba con otra fecha.
            </p>
          )}

          <div className="flex gap-2 mt-4">
            <button onClick={backToList} className="flex-1 py-2.5 rounded-lg border border-neutral-200 text-sm">
              Atrás
            </button>
            <button
              disabled={!time}
              onClick={() => setStep(3)}
              className="flex-1 py-2.5 rounded-lg text-sm font-medium disabled:opacity-40"
              style={{ backgroundColor: buttonColor, color: buttonTextColor }}
            >
              Continuar
            </button>
          </div>
        </div>
      )}

      {step === 3 && service && (
        <div>
          <p className="text-sm opacity-60 mb-2.5">Confirma tu reserva</p>
          <div className="border border-neutral-200 rounded-lg p-3 mb-3 text-sm">
            <Row label="Servicio" value={service.name} />
            <Row
              label="Fecha"
              value={new Date(
                Number(dateParam.split("-")[0]),
                Number(dateParam.split("-")[1]) - 1,
                Number(dateParam.split("-")[2])
              ).toLocaleDateString("es", { weekday: "long", day: "numeric", month: "short" })}
            />
            <Row label="Hora" value={time ?? ""} />
            <Row label="Precio" value={formatCurrency(service.price, currency)} bold />
          </div>
          <input
            placeholder="Tu nombre"
            value={customer.name}
            onChange={(e) => setCustomer({ ...customer, name: e.target.value })}
            className="w-full px-3 py-2.5 rounded-lg border border-neutral-200 text-sm mb-2"
          />
          <input
            type="email"
            placeholder="name@correo.com"
            value={customer.email}
            onChange={(e) => setCustomer({ ...customer, email: e.target.value })}
            className="w-full px-3 py-2.5 rounded-lg border border-neutral-200 text-sm mb-3"
          />
          {status === "error" && <p className="text-red-600 text-sm mb-2">{errorMsg}</p>}
          <div className="flex gap-2">
            <button onClick={() => setStep(2)} className="flex-1 py-2.5 rounded-lg border border-neutral-200 text-sm">
              Atrás
            </button>
            <button
              disabled={!customer.name || !customer.email || status === "sending"}
              onClick={confirm}
              className="flex-1 py-2.5 rounded-lg text-sm font-medium disabled:opacity-40"
              style={{ backgroundColor: buttonColor, color: buttonTextColor }}
            >
              {status === "sending" ? "Enviando..." : "Confirmar"}
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
