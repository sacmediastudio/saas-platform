"use client";

import { useState } from "react";
import { MapPin, Plus, Pencil, Trash2 } from "lucide-react";
import DashboardCard from "@/components/dashboard-card";
import { useDashboardLang } from "@/lib/dashboard-lang-context";

interface LocationItem {
  id: string;
  name: string;
  address: string | null;
  contactPhone: string | null;
  pickupEnabled: boolean;
  deliveryEnabled: boolean;
  deliveryFee: number | null;
  minDeliveryAmount: number | null;
  isActive: boolean;
}

interface FormState {
  name: string;
  address: string;
  contactPhone: string;
  pickupEnabled: boolean;
  deliveryEnabled: boolean;
  deliveryFee: string;
  minDeliveryAmount: string;
}

const EMPTY_FORM: FormState = {
  name: "",
  address: "",
  contactPhone: "",
  pickupEnabled: true,
  deliveryEnabled: false,
  deliveryFee: "",
  minDeliveryAmount: "",
};

export default function LocationsManager({ initialLocations }: { initialLocations: LocationItem[] }) {
  const { t } = useDashboardLang();
  const [locations, setLocations] = useState(initialLocations);
  // null = ninguna edición abierta, "new" = creando, o el id de la que se está editando.
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  function startCreate() {
    setForm(EMPTY_FORM);
    setEditingId("new");
  }

  function startEdit(loc: LocationItem) {
    setForm({
      name: loc.name,
      address: loc.address ?? "",
      contactPhone: loc.contactPhone ?? "",
      pickupEnabled: loc.pickupEnabled,
      deliveryEnabled: loc.deliveryEnabled,
      deliveryFee: loc.deliveryFee !== null ? String(loc.deliveryFee) : "",
      minDeliveryAmount: loc.minDeliveryAmount !== null ? String(loc.minDeliveryAmount) : "",
    });
    setEditingId(loc.id);
  }

  async function handleSave() {
    if (!form.name.trim() || editingId === null) return;
    setSaving(true);
    const isNew = editingId === "new";
    const payload = {
      name: form.name.trim(),
      address: form.address.trim() || null,
      contactPhone: form.contactPhone.trim() || null,
      pickupEnabled: form.pickupEnabled,
      deliveryEnabled: form.deliveryEnabled,
      deliveryFee: form.deliveryFee ? Number(form.deliveryFee) : null,
      minDeliveryAmount: form.minDeliveryAmount ? Number(form.minDeliveryAmount) : null,
    };
    const res = await fetch(isNew ? "/api/tenant/locations" : `/api/tenant/locations/${editingId}`, {
      method: isNew ? "POST" : "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (res.ok) {
      const { location } = await res.json();
      setLocations((prev) => (isNew ? [...prev, location] : prev.map((l) => (l.id === location.id ? location : l))));
      setEditingId(null);
    }
    setSaving(false);
  }

  async function toggleActive(loc: LocationItem) {
    const res = await fetch(`/api/tenant/locations/${loc.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: !loc.isActive }),
    });
    if (res.ok) {
      const { location } = await res.json();
      setLocations((prev) => prev.map((l) => (l.id === loc.id ? location : l)));
    }
  }

  async function handleDelete(loc: LocationItem) {
    if (!confirm(t.orders.locations.confirmDelete(loc.name))) return;
    const res = await fetch(`/api/tenant/locations/${loc.id}`, { method: "DELETE" });
    if (res.ok) setLocations((prev) => prev.filter((l) => l.id !== loc.id));
  }

  return (
    <DashboardCard>
      <div className="flex items-center justify-between gap-2 mb-1">
        <h2 className="text-xl font-semibold flex items-center gap-2">
          <MapPin size={20} aria-hidden />
          {t.orders.locations.title}
        </h2>
        {editingId === null && (
          <button
            onClick={startCreate}
            className="flex items-center gap-1.5 text-xs font-semibold px-3 h-8 rounded-lg bg-[#E7FF00] text-[#002D09] hover:brightness-105"
          >
            <Plus size={14} aria-hidden /> {t.orders.locations.add}
          </button>
        )}
      </div>
      <p className="text-sm text-[#343233]/70 mb-4">{t.orders.locations.subtitle}</p>

      {locations.length === 0 && editingId === null && (
        <p className="text-sm text-[#343233]/60">{t.orders.locations.empty}</p>
      )}

      {locations.length > 0 && (
        <div className="flex flex-col gap-3">
          {locations.map((loc) => (
            <div key={loc.id} className="border border-[#002D09]/10 rounded-lg p-4 flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm font-semibold flex items-center gap-2 flex-wrap">
                  {loc.name}
                  {!loc.isActive && (
                    <span className="text-xs px-2 py-0.5 rounded-md bg-[#F7F8F4] text-[#343233]/60">
                      {t.orders.locations.inactive}
                    </span>
                  )}
                </p>
                {loc.address && <p className="text-xs text-[#343233]/60 mt-0.5">{loc.address}</p>}
                <p className="text-xs text-[#343233]/60 mt-1">
                  {[loc.pickupEnabled && t.orders.pickupShort, loc.deliveryEnabled && t.orders.delivery].filter(Boolean).join(" · ")}
                </p>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  onClick={() => toggleActive(loc)}
                  className="text-xs px-2.5 py-1.5 rounded-md border border-[#002D09]/15 hover:bg-[#F7F8F4]"
                >
                  {loc.isActive ? t.orders.locations.deactivate : t.orders.locations.activate}
                </button>
                <button
                  onClick={() => startEdit(loc)}
                  aria-label={t.orders.locations.edit}
                  className="p-1.5 rounded-md hover:bg-[#F7F8F4]"
                >
                  <Pencil size={15} aria-hidden />
                </button>
                <button
                  onClick={() => handleDelete(loc)}
                  aria-label={t.orders.locations.delete}
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
        <div className="mt-4 border border-[#002D09]/10 rounded-lg p-4 flex flex-col gap-3">
          <input
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            placeholder={t.orders.locations.namePlaceholder}
            className="w-full bg-[#F7F8F4] border border-[#002D09]/15 rounded-lg px-3 py-2 text-sm outline-none"
          />
          <input
            value={form.address}
            onChange={(e) => setForm({ ...form, address: e.target.value })}
            placeholder={t.orders.locations.addressPlaceholder}
            className="w-full bg-[#F7F8F4] border border-[#002D09]/15 rounded-lg px-3 py-2 text-sm outline-none"
          />
          <input
            value={form.contactPhone}
            onChange={(e) => setForm({ ...form, contactPhone: e.target.value })}
            placeholder={t.orders.locations.phonePlaceholder}
            className="w-full bg-[#F7F8F4] border border-[#002D09]/15 rounded-lg px-3 py-2 text-sm outline-none"
          />
          <div className="flex flex-col gap-2">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={form.pickupEnabled}
                onChange={(e) => setForm({ ...form, pickupEnabled: e.target.checked })}
                className="w-4 h-4 accent-[#E7FF00]"
              />
              {t.orders.pickup}
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={form.deliveryEnabled}
                onChange={(e) => setForm({ ...form, deliveryEnabled: e.target.checked })}
                className="w-4 h-4 accent-[#E7FF00]"
              />
              {t.orders.delivery}
            </label>
          </div>
          {form.deliveryEnabled && (
            <div className="flex flex-wrap gap-4">
              <label className="flex items-center gap-2">
                <span className="text-sm text-[#343233]/70">{t.orders.deliveryFee}</span>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.deliveryFee}
                  onChange={(e) => setForm({ ...form, deliveryFee: e.target.value })}
                  placeholder="0"
                  className="w-24 bg-white border border-[#002D09]/15 rounded-lg px-2.5 py-1.5 text-sm outline-none"
                />
              </label>
              <label className="flex items-center gap-2">
                <span className="text-sm text-[#343233]/70">{t.orders.minOrder}</span>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.minDeliveryAmount}
                  onChange={(e) => setForm({ ...form, minDeliveryAmount: e.target.value })}
                  placeholder={t.orders.noMinimum}
                  className="w-28 bg-white border border-[#002D09]/15 rounded-lg px-2.5 py-1.5 text-sm outline-none"
                />
              </label>
            </div>
          )}
          <div className="flex gap-2 mt-1">
            <button
              onClick={handleSave}
              disabled={saving || !form.name.trim()}
              className="text-sm font-semibold px-4 h-9 rounded-lg bg-[#E7FF00] text-[#002D09] hover:brightness-105 disabled:opacity-50"
            >
              {saving ? t.orders.saving : t.orders.save}
            </button>
            <button
              onClick={() => setEditingId(null)}
              className="text-sm font-medium px-4 h-9 rounded-lg border border-[#002D09]/15 hover:bg-[#F7F8F4]"
            >
              {t.orders.cancel}
            </button>
          </div>
        </div>
      )}
    </DashboardCard>
  );
}
