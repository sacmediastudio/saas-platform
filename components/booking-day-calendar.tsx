"use client";

import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, Lock, Plus, Phone, Mail } from "lucide-react";

interface DayHours {
  isOpen: boolean;
  startTime: string;
  endTime: string;
}
interface DayBooking {
  id: string;
  datetime: string;
  durationMinutes: number;
  status: "PENDING" | "CONFIRMED" | "CANCELLED" | "COMPLETED";
  customerName: string;
  customerEmail: string;
  customerPhone: string | null;
  serviceName: string;
  staffName: string | null;
}
interface DayBlock {
  id: string;
  startTime: string;
  endTime: string;
  reason: string | null;
}

const statusStyles: Record<DayBooking["status"], { label: string; className: string }> = {
  PENDING: { label: "Pendiente", className: "bg-amber-50 text-amber-700" },
  CONFIRMED: { label: "Confirmada", className: "bg-green-50 text-green-700" },
  CANCELLED: { label: "Cancelada", className: "bg-red-50 text-red-700" },
  COMPLETED: { label: "Completada", className: "bg-[#F7F8F4] text-[#343233]/70" },
};

function toDateParam(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function timeToMinutes(t: string) {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}
function minutesToLabel(mins: number) {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  const period = h < 12 ? "a.m." : "p.m.";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${String(m).padStart(2, "0")} ${period}`;
}

const GRID_STEP = 30; // minutos por fila visual

export default function BookingDayCalendar({
  onCreateBooking,
  onUpdateStatus,
  refreshKey,
}: {
  onCreateBooking: (dateParam: string, time: string) => void;
  onUpdateStatus: (id: string, status: "CONFIRMED" | "CANCELLED") => Promise<void>;
  refreshKey: number;
}) {
  const [date, setDate] = useState(() => new Date());
  const [dayHours, setDayHours] = useState<DayHours | null>(null);
  const [bookings, setBookings] = useState<DayBooking[]>([]);
  const [blocks, setBlocks] = useState<DayBlock[]>([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState<string | null>(null);

  const dateParam = toDateParam(date);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/bookings/day?date=${dateParam}`)
      .then((r) => r.json())
      .then((data) => {
        setDayHours(data.dayHours ?? null);
        setBookings(data.bookings ?? []);
        setBlocks(data.blocks ?? []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dateParam, refreshKey]);

  function shiftDay(delta: number) {
    setDate((d) => {
      const next = new Date(d);
      next.setDate(next.getDate() + delta);
      return next;
    });
  }

  async function handleUpdateStatus(id: string, status: "CONFIRMED" | "CANCELLED") {
    setUpdating(id);
    await onUpdateStatus(id, status);
    setBookings((prev) => prev.map((b) => (b.id === id ? { ...b, status } : b)));
    setUpdating(null);
  }

  const isToday = toDateParam(new Date()) === dateParam;

  // Genera las filas de la grilla visual (cada GRID_STEP minutos) dentro
  // del horario de atención de ese día, marcando cada una como cita,
  // continuación de una cita, bloqueo, o libre.
  const rows: {
    minute: number;
    kind: "booking" | "booking-continues" | "block" | "free";
    booking?: DayBooking;
    block?: DayBlock;
  }[] = [];

  if (dayHours?.isOpen) {
    const start = timeToMinutes(dayHours.startTime);
    const end = timeToMinutes(dayHours.endTime);

    for (let m = start; m < end; m += GRID_STEP) {
      const rowStart = new Date(date);
      rowStart.setHours(0, m, 0, 0);
      const rowEnd = new Date(rowStart.getTime() + GRID_STEP * 60_000);

      const startingBooking = bookings.find((b) => {
        const bMin = new Date(b.datetime).getHours() * 60 + new Date(b.datetime).getMinutes();
        return bMin === m && b.status !== "CANCELLED";
      });
      if (startingBooking) {
        rows.push({ minute: m, kind: "booking", booking: startingBooking });
        continue;
      }

      const withinBooking = bookings.find((b) => {
        if (b.status === "CANCELLED") return false;
        const bStart = new Date(b.datetime);
        const bMin = bStart.getHours() * 60 + bStart.getMinutes();
        return m > bMin && m < bMin + b.durationMinutes;
      });
      if (withinBooking) {
        rows.push({ minute: m, kind: "booking-continues" });
        continue;
      }

      const block = blocks.find((b) => {
        const bs = new Date(b.startTime);
        const be = new Date(b.endTime);
        return rowStart < be && rowEnd > bs;
      });
      if (block) {
        rows.push({ minute: m, kind: "block", block });
        continue;
      }

      rows.push({ minute: m, kind: "free" });
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <button onClick={() => shiftDay(-1)} aria-label="Día anterior" className="p-1.5 hover:bg-[#F7F8F4] rounded-lg">
          <ChevronLeft size={18} aria-hidden />
        </button>
        <div className="text-center">
          <p className="text-sm font-semibold capitalize">
            {date.toLocaleDateString("es", { weekday: "long", day: "numeric", month: "long" })}
          </p>
          {!isToday && (
            <button onClick={() => setDate(new Date())} className="text-xs text-[#343233]/60 underline">
              Volver a hoy
            </button>
          )}
        </div>
        <button onClick={() => shiftDay(1)} aria-label="Día siguiente" className="p-1.5 hover:bg-[#F7F8F4] rounded-lg">
          <ChevronRight size={18} aria-hidden />
        </button>
      </div>

      {loading ? (
        <p className="text-sm text-[#343233]/60">Cargando...</p>
      ) : !dayHours?.isOpen ? (
        <p className="text-sm text-[#343233]/60 py-6 text-center border border-[#002D09]/10 rounded-lg">
          Cerrado este día. Cámbialo en "Horario de atención" si quieres atender igual.
        </p>
      ) : (
        <div className="border border-[#002D09]/10 rounded-lg overflow-hidden divide-y divide-[#002D09]/10">
          {rows.map((row) => {
            if (row.kind === "booking-continues") {
              return <div key={row.minute} className="h-2 bg-[#F7F8F4]" />;
            }
            if (row.kind === "block") {
              return (
                <div key={row.minute} className="flex items-center gap-2.5 px-3.5 py-2 bg-red-50/60">
                  <span className="text-xs text-[#343233]/60 w-16 shrink-0">{minutesToLabel(row.minute)}</span>
                  <Lock size={13} className="text-red-500 shrink-0" aria-hidden />
                  <span className="text-xs text-red-700">{row.block?.reason || "Horario bloqueado"}</span>
                </div>
              );
            }
            if (row.kind === "booking" && row.booking) {
              const b = row.booking;
              const s = statusStyles[b.status];
              return (
                <div key={row.minute} className="flex flex-wrap items-start gap-2.5 px-3.5 py-2.5">
                  <span className="text-xs text-[#343233]/60 w-16 shrink-0 pt-0.5">{minutesToLabel(row.minute)}</span>
                  <div className="flex-1 min-w-[160px]">
                    <p className="text-sm font-medium">{b.serviceName}</p>
                    <p className="text-xs text-[#343233]/70">
                      {b.customerName}
                      {b.staffName ? ` · con ${b.staffName}` : ""} · {b.durationMinutes} min
                    </p>
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 mt-1">
                      {b.customerPhone && (
                        <a
                          href={`tel:${b.customerPhone.replace(/\s+/g, "")}`}
                          className="flex items-center gap-1 text-xs text-[#343233]/70 hover:text-[#002D09] underline"
                        >
                          <Phone size={11} aria-hidden />
                          {b.customerPhone}
                        </a>
                      )}
                      <a
                        href={`mailto:${b.customerEmail}`}
                        className="flex items-center gap-1 text-xs text-[#343233]/70 hover:text-[#002D09] underline"
                      >
                        <Mail size={11} aria-hidden />
                        {b.customerEmail}
                      </a>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className={`text-xs px-2 py-1 rounded-md font-medium ${s.className}`}>{s.label}</span>
                    {b.status === "PENDING" && (
                      <button
                        onClick={() => handleUpdateStatus(b.id, "CONFIRMED")}
                        disabled={updating === b.id}
                        className="text-xs px-2 py-1 rounded-md border border-[#002D09]/15 hover:bg-white"
                      >
                        Confirmar
                      </button>
                    )}
                    {b.status !== "CANCELLED" && b.status !== "COMPLETED" && (
                      <button
                        onClick={() => handleUpdateStatus(b.id, "CANCELLED")}
                        disabled={updating === b.id}
                        className="text-xs px-2 py-1 rounded-md border border-[#002D09]/15 hover:bg-white"
                      >
                        Cancelar
                      </button>
                    )}
                  </div>
                </div>
              );
            }
            // libre
            return (
              <button
                key={row.minute}
                onClick={() => onCreateBooking(dateParam, `${String(Math.floor(row.minute / 60)).padStart(2, "0")}:${String(row.minute % 60).padStart(2, "0")}`)}
                className="w-full flex items-center gap-2.5 px-3.5 py-2 hover:bg-[#F7F8F4] text-left group"
              >
                <span className="text-xs text-[#343233]/60 w-16 shrink-0">{minutesToLabel(row.minute)}</span>
                <span className="text-xs text-[#343233]/40 group-hover:text-[#002D09] flex items-center gap-1">
                  <Plus size={12} aria-hidden />
                  Libre — agregar cita
                </span>
              </button>
            );
          })}
          {rows.length === 0 && (
            <p className="px-3.5 py-4 text-sm text-[#343233]/60">Sin horario configurado para este día.</p>
          )}
        </div>
      )}
    </div>
  );
}
