"use client";

import { useEffect, useState } from "react";
import { Check } from "lucide-react";

interface DayRow {
  dayOfWeek: number;
  isOpen: boolean;
  startTime: string;
  endTime: string;
}

const DAY_LABELS = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];

export default function BusinessHoursEditor() {
  const [days, setDays] = useState<DayRow[] | null>(null);
  const [bufferMinutes, setBufferMinutes] = useState(15);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/business-hours")
      .then((r) => r.json())
      .then((data) => {
        setDays(data.hours ?? []);
        setBufferMinutes(data.bufferMinutes ?? 15);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  function updateDay(dayOfWeek: number, patch: Partial<DayRow>) {
    setDays((prev) => (prev ? prev.map((d) => (d.dayOfWeek === dayOfWeek ? { ...d, ...patch } : d)) : prev));
  }

  async function handleSave() {
    if (!days) return;
    setSaving(true);
    setError(null);
    setSaved(false);

    const res = await fetch("/api/business-hours", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ days, bufferMinutes }),
    });

    if (!res.ok) {
      let message = "No se pudo guardar el horario";
      try {
        const body = await res.json();
        if (typeof body.error === "string") message = body.error;
      } catch {}
      setError(message);
      setSaving(false);
      return;
    }

    setSaved(true);
    setSaving(false);
    setTimeout(() => setSaved(false), 2000);
  }

  if (loading || !days) {
    return <p className="text-sm text-[#343233]/60">Cargando horario...</p>;
  }

  return (
    <div>
      <div className="flex flex-col gap-2 mb-4">
        {days
          .slice()
          .sort((a, b) => (a.dayOfWeek === 0 ? 7 : a.dayOfWeek) - (b.dayOfWeek === 0 ? 7 : b.dayOfWeek))
          .map((day) => (
            <div key={day.dayOfWeek} className="flex flex-wrap items-center gap-3 border border-[#002D09]/10 rounded-lg px-3.5 py-2.5">
              <label className="flex items-center gap-2 w-28 shrink-0">
                <input
                  type="checkbox"
                  checked={day.isOpen}
                  onChange={(e) => updateDay(day.dayOfWeek, { isOpen: e.target.checked })}
                  className="w-4 h-4 accent-[#E7FF00]"
                />
                <span className="text-sm font-medium">{DAY_LABELS[day.dayOfWeek]}</span>
              </label>
              {day.isOpen ? (
                <div className="flex items-center gap-2">
                  <input
                    type="time"
                    value={day.startTime}
                    onChange={(e) => updateDay(day.dayOfWeek, { startTime: e.target.value })}
                    className="bg-[#F7F8F4] border border-[#002D09]/15 rounded-lg px-2.5 py-1.5 text-sm outline-none"
                  />
                  <span className="text-sm text-[#343233]/50">a</span>
                  <input
                    type="time"
                    value={day.endTime}
                    onChange={(e) => updateDay(day.dayOfWeek, { endTime: e.target.value })}
                    className="bg-[#F7F8F4] border border-[#002D09]/15 rounded-lg px-2.5 py-1.5 text-sm outline-none"
                  />
                </div>
              ) : (
                <span className="text-sm text-[#343233]/50">Cerrado</span>
              )}
            </div>
          ))}
      </div>

      <label className="flex items-center gap-3 mb-4">
        <span className="text-sm">Espacio entre citas</span>
        <input
          type="number"
          min="0"
          max="120"
          step="5"
          value={bufferMinutes}
          onChange={(e) => setBufferMinutes(Number(e.target.value))}
          className="w-20 bg-[#F7F8F4] border border-[#002D09]/15 rounded-lg px-2.5 py-1.5 text-sm outline-none"
        />
        <span className="text-sm text-[#343233]/60">minutos</span>
      </label>

      <div className="flex items-center gap-3">
        <button
          onClick={handleSave}
          disabled={saving}
          className="text-sm font-semibold px-4 h-9 rounded-lg bg-[#E7FF00] text-[#002D09] hover:brightness-105 disabled:opacity-50"
        >
          {saving ? "Guardando..." : "Guardar horario"}
        </button>
        {saved && (
          <span className="flex items-center gap-1 text-sm text-green-700">
            <Check size={14} aria-hidden /> Guardado
          </span>
        )}
        {error && <span className="text-sm text-red-600">{error}</span>}
      </div>
    </div>
  );
}
