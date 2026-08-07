"use client";

import { useState } from "react";
import { formatCurrency } from "@/lib/currency";

interface ServiceOption {
  id: string;
  name: string;
  durationMinutes: number;
  price: number;
  staffId: string | null;
}

const DAYS = Array.from({ length: 4 }).map((_, i) => {
  const d = new Date();
  d.setDate(d.getDate() + i);
  return d;
});
const HOURS = ["09:00", "10:30", "12:00", "14:00", "15:30", "17:00"];

export default function BookingFlow({
  tenantName,
  tenantSlug,
  tenantTagline,
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
  services: ServiceOption[];
  currency: string;
  themeBgColor: string;
  themeTextColor: string;
  buttonColor: string;
  buttonTextColor: string;
}) {
  const [step, setStep] = useState(1);
  const [service, setService] = useState<ServiceOption | null>(null);
  const [day, setDay] = useState(DAYS[0]);
  const [time, setTime] = useState<string | null>(null);
  const [customer, setCustomer] = useState({ name: "", email: "" });
  const [status, setStatus] = useState<"idle" | "sending" | "done" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");

  async function confirm() {
    if (!service || !time) return;
    setStatus("sending");

    const [h, m] = time.split(":").map(Number);
    const datetime = new Date(day);
    datetime.setHours(h, m, 0, 0);

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
        <a
          href={`/review/${tenantSlug}`}
          className="text-sm font-medium underline mt-6"
          style={{ opacity: 0.8 }}
        >
          ¿Ya visitaste antes? Deja tu reseña
        </a>
        <div className="flex justify-center pt-8 opacity-50">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.svg" alt="Zertoo" className="h-4 w-auto" />
        </div>
      </div>
    );
  }

  return (
    <div
      className="max-w-sm mx-auto min-h-screen px-4 pt-10"
      style={{ backgroundColor: themeBgColor, color: themeTextColor }}
    >
      <p className="text-base font-semibold mb-1">Reservar en {tenantName}</p>
      {tenantTagline && <p className="text-xs opacity-60 mb-5 leading-relaxed">{tenantTagline}</p>}
      {!tenantTagline && <div className="mb-4" />}

      {step === 1 && (
        <div>
          <p className="text-sm text-neutral-500 mb-2.5">Elige un servicio</p>
          <div className="flex flex-col gap-2">
            {services.map((s) => (
              <div
                key={s.id}
                onClick={() => setService(s)}
                className="flex justify-between items-center rounded-lg px-3 py-2.5 cursor-pointer border"
                style={{ borderColor: service?.id === s.id ? buttonColor : "#e5e5e5", borderWidth: service?.id === s.id ? 1.5 : 1 }}
              >
                <div>
                  <p className="text-sm font-medium">{s.name}</p>
                  <p className="text-xs text-neutral-500 mt-0.5">{s.durationMinutes} min</p>
                </div>
                <span className="text-sm font-medium">{formatCurrency(s.price, currency)}</span>
              </div>
            ))}
          </div>
          <button
            disabled={!service}
            onClick={() => setStep(2)}
            className="w-full py-2.5 rounded-lg mt-4 text-sm font-medium disabled:opacity-40"
            style={{ backgroundColor: buttonColor, color: buttonTextColor }}
          >
            Continuar
          </button>
        </div>
      )}

      {step === 2 && (
        <div>
          <p className="text-sm text-neutral-500 mb-2.5">Elige fecha y hora</p>
          <div className="flex gap-1.5 mb-3">
            {DAYS.map((d) => (
              <span
                key={d.toISOString()}
                onClick={() => setDay(d)}
                className="flex-1 text-center rounded-lg py-2 text-xs cursor-pointer border"
                style={{ borderColor: d.toDateString() === day.toDateString() ? buttonColor : "#e5e5e5", borderWidth: d.toDateString() === day.toDateString() ? 1.5 : 1 }}
              >
                {d.toLocaleDateString("es", { weekday: "short", day: "numeric" })}
              </span>
            ))}
          </div>
          <div className="grid grid-cols-3 gap-2">
            {HOURS.map((h) => (
              <span
                key={h}
                onClick={() => setTime(h)}
                className="text-center rounded-lg py-2 text-sm cursor-pointer border"
                style={{ borderColor: time === h ? buttonColor : "#e5e5e5", borderWidth: time === h ? 1.5 : 1 }}
              >
                {h}
              </span>
            ))}
          </div>
          <div className="flex gap-2 mt-4">
            <button onClick={() => setStep(1)} className="flex-1 py-2.5 rounded-lg border border-neutral-200 text-sm">
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
          <p className="text-sm text-neutral-500 mb-2.5">Confirma tu reserva</p>
          <div className="border border-neutral-200 rounded-lg p-3 mb-3 text-sm">
            <Row label="Servicio" value={service.name} />
            <Row label="Fecha" value={day.toLocaleDateString("es", { weekday: "long", day: "numeric", month: "short" })} />
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
