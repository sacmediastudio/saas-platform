"use client";

import { useState } from "react";
import { LayoutGrid, Plus, Pencil, Trash2, Lock } from "lucide-react";
import DashboardCard from "@/components/dashboard-card";
import { useDashboardLang } from "@/lib/dashboard-lang-context";

interface Table {
  id: string;
  name: string;
  zone: string | null;
  seats: number | null;
}

interface FormState {
  name: string;
  zone: string;
  seats: string;
}

const EMPTY_FORM: FormState = { name: "", zone: "", seats: "" };

export default function TablesManager({
  moduleEnabled,
  initialTables,
}: {
  moduleEnabled: boolean;
  initialTables: Table[];
}) {
  const { t } = useDashboardLang();
  const s = t.orders.tables;

  const [tables, setTables] = useState(initialTables);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  if (!moduleEnabled) {
    return (
      <DashboardCard>
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#F7F8F4] flex items-center justify-center shrink-0">
            <Lock size={18} className="text-[#002D09]" aria-hidden />
          </div>
          <div>
            <h2 className="text-lg font-semibold mb-1">{s.moduleLockedTitle}</h2>
            <p className="text-sm text-[#343233]/70 mb-3">{s.moduleLockedBody}</p>
            <a
              href="/dashboard/modules"
              className="inline-block text-xs font-semibold px-3 h-8 leading-8 rounded-lg bg-[#E7FF00] text-[#002D09] hover:brightness-105"
            >
              {s.moduleLockedCta}
            </a>
          </div>
        </div>
      </DashboardCard>
    );
  }

  function startCreate() {
    setForm(EMPTY_FORM);
    setEditingId("new");
  }

  function startEdit(table: Table) {
    setForm({ name: table.name, zone: table.zone ?? "", seats: table.seats !== null ? String(table.seats) : "" });
    setEditingId(table.id);
  }

  async function handleSave() {
    if (!form.name.trim() || editingId === null) return;
    setSaving(true);
    const isNew = editingId === "new";
    const payload = {
      name: form.name.trim(),
      zone: form.zone.trim() || null,
      seats: form.seats ? Number(form.seats) : null,
    };
    const res = await fetch(isNew ? "/api/tenant/tables" : `/api/tenant/tables/${editingId}`, {
      method: isNew ? "POST" : "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (res.ok) {
      const { table } = await res.json();
      setTables((prev) => (isNew ? [...prev, table] : prev.map((tb) => (tb.id === table.id ? table : tb))));
      setEditingId(null);
    }
    setSaving(false);
  }

  async function handleDelete(table: Table) {
    if (!confirm(s.confirmDelete(table.name))) return;
    const res = await fetch(`/api/tenant/tables/${table.id}`, { method: "DELETE" });
    if (res.ok) setTables((prev) => prev.filter((tb) => tb.id !== table.id));
  }

  return (
    <DashboardCard>
      <div className="flex items-center justify-between gap-2 mb-1">
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <LayoutGrid size={18} aria-hidden />
          {s.title}
        </h2>
        {editingId === null && (
          <button
            onClick={startCreate}
            className="flex items-center gap-1.5 text-xs font-semibold px-3 h-8 rounded-lg bg-[#E7FF00] text-[#002D09] hover:brightness-105"
          >
            <Plus size={14} aria-hidden /> {s.add}
          </button>
        )}
      </div>
      <p className="text-sm text-[#343233]/70 mb-4">{s.subtitle}</p>

      {tables.length === 0 && editingId === null && <p className="text-sm text-[#343233]/60">{s.empty}</p>}

      {tables.length > 0 && (
        <div className="flex flex-col gap-2 mb-2">
          {tables.map((table) => (
            <div key={table.id} className="border border-[#002D09]/10 rounded-lg p-3 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm font-semibold">{table.name}</p>
                <p className="text-xs text-[#343233]/60">
                  {[table.zone, table.seats ? s.seatsLabel(table.seats) : null].filter(Boolean).join(" · ") || "—"}
                </p>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <button onClick={() => startEdit(table)} aria-label={s.edit} className="p-1.5 rounded-md hover:bg-[#F7F8F4]">
                  <Pencil size={15} aria-hidden />
                </button>
                <button
                  onClick={() => handleDelete(table)}
                  aria-label={s.delete}
                  className="p-1.5 rounded-md hover:bg-[#F7F8F4] text-red-600"
                >
                  <Trash2 size={15} aria-hidden />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {editingId !== null && (
        <div className="border border-[#002D09]/10 rounded-lg p-4 flex flex-col gap-3">
          <input
            autoFocus
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            placeholder={s.namePlaceholder}
            className="w-full bg-[#F7F8F4] border border-[#002D09]/15 rounded-lg px-3 py-2 text-sm outline-none"
          />
          <div className="flex gap-2">
            <input
              value={form.zone}
              onChange={(e) => setForm({ ...form, zone: e.target.value })}
              placeholder={s.zonePlaceholder}
              className="flex-1 bg-[#F7F8F4] border border-[#002D09]/15 rounded-lg px-3 py-2 text-sm outline-none"
            />
            <input
              type="number"
              min="1"
              value={form.seats}
              onChange={(e) => setForm({ ...form, seats: e.target.value })}
              placeholder={s.seatsPlaceholder}
              className="w-28 bg-[#F7F8F4] border border-[#002D09]/15 rounded-lg px-3 py-2 text-sm outline-none"
            />
          </div>
          <div className="flex gap-2 mt-1">
            <button
              onClick={handleSave}
              disabled={saving || !form.name.trim()}
              className="text-sm font-semibold px-4 h-9 rounded-lg bg-[#E7FF00] text-[#002D09] hover:brightness-105 disabled:opacity-50"
            >
              {saving ? t.common.saving : t.common.save}
            </button>
            <button
              onClick={() => setEditingId(null)}
              className="text-sm font-medium px-4 h-9 rounded-lg border border-[#002D09]/15 hover:bg-[#F7F8F4]"
            >
              {t.common.cancel}
            </button>
          </div>
        </div>
      )}
    </DashboardCard>
  );
}
