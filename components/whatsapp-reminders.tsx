"use client";

import { useEffect, useState } from "react";
import { MessageCircle, Check } from "lucide-react";

export default function WhatsAppReminders() {
  const [configured, setConfigured] = useState<boolean | null>(null);
  const [enabled, setEnabled] = useState(true);
  const [hoursBefore, setHoursBefore] = useState(24);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    fetch("/api/tenant/reminders")
      .then((r) => r.json())
      .then((data) => {
        setConfigured(data.configured);
        setEnabled(data.remindersEnabled);
        setHoursBefore(data.reminderHoursBefore);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  async function handleSave() {
    setSaving(true);
    setSaved(false);
    const res = await fetch("/api/tenant/reminders", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ remindersEnabled: enabled, reminderHoursBefore: hoursBefore }),
    });
    if (res.ok) {
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    }
    setSaving(false);
  }

  if (loading) return <p className="text-sm text-[#343233]/60">Cargando...</p>;

  return (
    <div className="border border-[#002D09]/10 rounded-lg p-4">
      {configured === false && (
        <p className="text-sm text-amber-700 bg-amber-50 rounded-md px-3 py-2 mb-4">
          Esta plataforma todavía no tiene WhatsApp configurado — los recordatorios no se van a
          mandar hasta que se active, pero puedes dejar tu preferencia guardada desde ya.
        </p>
      )}

      <div className="flex items-center gap-3 mb-4">
        <div className="w-9 h-9 rounded-lg bg-[#F7F8F4] flex items-center justify-center shrink-0">
          <MessageCircle size={16} className="text-[#002D09]" aria-hidden />
        </div>
        <div className="flex-1">
          <p className="text-sm font-semibold">Recordatorios por WhatsApp</p>
          <p className="text-xs text-[#343233]/60">
            Le avisamos al cliente antes de su cita, para reducir ausencias.
          </p>
        </div>
        <label className="relative inline-flex items-center cursor-pointer shrink-0">
          <input
            type="checkbox"
            checked={enabled}
            onChange={(e) => setEnabled(e.target.checked)}
            className="sr-only peer"
          />
          <div className="w-10 h-6 bg-[#F7F8F4] border border-[#002D09]/15 rounded-full peer-checked:bg-[#E7FF00] transition-colors" />
          <div className="absolute left-1 top-1 w-4 h-4 bg-white border border-[#002D09]/15 rounded-full transition-transform peer-checked:translate-x-4" />
        </label>
      </div>

      {enabled && (
        <label className="flex items-center gap-3 mb-4">
          <span className="text-sm">Avisar</span>
          <input
            type="number"
            min="1"
            max="72"
            value={hoursBefore}
            onChange={(e) => setHoursBefore(Number(e.target.value))}
            className="w-20 bg-[#F7F8F4] border border-[#002D09]/15 rounded-lg px-2.5 py-1.5 text-sm outline-none"
          />
          <span className="text-sm text-[#343233]/60">horas antes de la cita</span>
        </label>
      )}

      <div className="flex items-center gap-3">
        <button
          onClick={handleSave}
          disabled={saving}
          className="text-sm font-semibold px-4 h-9 rounded-lg bg-[#E7FF00] text-[#002D09] hover:brightness-105 disabled:opacity-50"
        >
          {saving ? "Guardando..." : "Guardar"}
        </button>
        {saved && (
          <span className="flex items-center gap-1 text-sm text-green-700">
            <Check size={14} aria-hidden /> Guardado
          </span>
        )}
      </div>
    </div>
  );
}
