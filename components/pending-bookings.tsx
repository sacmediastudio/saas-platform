"use client";

import { useEffect, useState } from "react";
import { Phone, Mail } from "lucide-react";

interface PendingBooking {
  id: string;
  datetime: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string | null;
  serviceName: string;
  staffName: string | null;
}

export default function PendingBookings({ refreshKey, onUpdated }: { refreshKey: number; onUpdated: () => void }) {
  const [bookings, setBookings] = useState<PendingBooking[] | null>(null);
  const [updating, setUpdating] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/bookings/pending")
      .then((r) => r.json())
      .then((data) => setBookings(data.bookings ?? []))
      .catch(() => setBookings([]));
  }, [refreshKey]);

  async function updateStatus(id: string, status: "CONFIRMED" | "CANCELLED") {
    setUpdating(id);
    const res = await fetch(`/api/bookings/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    if (res.ok) {
      setBookings((prev) => (prev ? prev.filter((b) => b.id !== id) : prev));
      onUpdated();
    }
    setUpdating(null);
  }

  if (bookings === null) return null; // todavía cargando, no mostramos nada parpadeando
  if (bookings.length === 0) return null; // sin pendientes, no ocupamos espacio en el dashboard

  return (
    <div className="mb-8">
      <h2 className="text-sm font-semibold mb-2 flex items-center gap-2">
        Citas pendientes de confirmar
        <span className="text-xs px-1.5 py-0.5 rounded-full bg-amber-50 text-amber-700 font-semibold">
          {bookings.length}
        </span>
      </h2>
      <div className="border border-amber-200 rounded-lg overflow-hidden divide-y divide-amber-100">
        {bookings.map((b) => (
          <div key={b.id} className="flex flex-wrap items-start gap-2.5 px-3.5 py-2.5 bg-amber-50/40">
            <div className="flex-1 min-w-[180px]">
              <p className="text-sm font-medium">
                {b.serviceName} ·{" "}
                <span className="font-normal text-[#343233]/70">
                  {new Date(b.datetime).toLocaleDateString("es", { day: "numeric", month: "short" })}{" "}
                  {new Date(b.datetime).toLocaleTimeString("es", { hour: "2-digit", minute: "2-digit" })}
                </span>
              </p>
              <p className="text-xs text-[#343233]/70 mt-0.5">
                {b.customerName}
                {b.staffName ? ` · con ${b.staffName}` : ""}
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
              <button
                onClick={() => updateStatus(b.id, "CONFIRMED")}
                disabled={updating === b.id}
                className="text-xs px-2.5 py-1.5 rounded-md bg-[#E7FF00] text-[#002D09] font-medium hover:brightness-105"
              >
                Confirmar
              </button>
              <button
                onClick={() => updateStatus(b.id, "CANCELLED")}
                disabled={updating === b.id}
                className="text-xs px-2.5 py-1.5 rounded-md border border-[#002D09]/15 hover:bg-white"
              >
                Cancelar
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
