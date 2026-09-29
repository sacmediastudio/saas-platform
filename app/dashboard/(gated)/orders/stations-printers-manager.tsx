"use client";

import { useState } from "react";
import { ChefHat, Printer as PrinterIcon, Plus, Pencil, Trash2, Lock } from "lucide-react";
import DashboardCard from "@/components/dashboard-card";
import { useDashboardLang } from "@/lib/dashboard-lang-context";

interface Station {
  id: string;
  name: string;
}
interface PrinterItem {
  id: string;
  name: string;
  ipAddress: string;
  port: number;
  stationId: string | null;
  station: { id: string; name: string } | null;
}
interface CategoryRow {
  id: string;
  name: string;
  stationId: string | null;
}

export default function StationsPrintersManager({
  moduleEnabled,
  initialStations,
  initialPrinters,
  initialCategories,
}: {
  moduleEnabled: boolean;
  initialStations: Station[];
  initialPrinters: PrinterItem[];
  initialCategories: CategoryRow[];
}) {
  const { t } = useDashboardLang();
  const s = t.orders.stationsPrinters;

  const [stations, setStations] = useState(initialStations);
  const [printers, setPrinters] = useState(initialPrinters);
  const [categories, setCategories] = useState(initialCategories);

  const [addingStation, setAddingStation] = useState(false);
  const [stationName, setStationName] = useState("");
  const [editingStationId, setEditingStationId] = useState<string | null>(null);

  const [addingPrinter, setAddingPrinter] = useState(false);
  const [printerForm, setPrinterForm] = useState({ name: "", ipAddress: "", port: "9100", stationId: "" });
  const [editingPrinterId, setEditingPrinterId] = useState<string | null>(null);

  const [savingRouting, setSavingRouting] = useState<string | null>(null);

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

  async function createStation() {
    if (!stationName.trim()) return;
    const res = await fetch("/api/tenant/order-stations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: stationName.trim() }),
    });
    if (res.ok) {
      const { station } = await res.json();
      setStations((prev) => [...prev, station].sort((a, b) => a.name.localeCompare(b.name)));
      setStationName("");
      setAddingStation(false);
    }
  }

  async function renameStation(id: string, name: string) {
    if (!name.trim()) return;
    const res = await fetch(`/api/tenant/order-stations/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: name.trim() }),
    });
    if (res.ok) {
      const { station } = await res.json();
      setStations((prev) => prev.map((st) => (st.id === id ? station : st)).sort((a, b) => a.name.localeCompare(b.name)));
      setEditingStationId(null);
    }
  }

  async function deleteStation(station: Station) {
    if (!confirm(s.confirmDeleteStation(station.name))) return;
    const res = await fetch(`/api/tenant/order-stations/${station.id}`, { method: "DELETE" });
    if (res.ok) {
      setStations((prev) => prev.filter((st) => st.id !== station.id));
      setPrinters((prev) => prev.map((p) => (p.stationId === station.id ? { ...p, stationId: null, station: null } : p)));
      setCategories((prev) => prev.map((c) => (c.stationId === station.id ? { ...c, stationId: null } : c)));
    }
  }

  async function createPrinter() {
    if (!printerForm.name.trim() || !printerForm.ipAddress.trim()) return;
    const res = await fetch("/api/tenant/order-printers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: printerForm.name.trim(),
        ipAddress: printerForm.ipAddress.trim(),
        port: Number(printerForm.port) || 9100,
        stationId: printerForm.stationId || null,
      }),
    });
    if (res.ok) {
      const { printer } = await res.json();
      setPrinters((prev) => [...prev, printer].sort((a, b) => a.name.localeCompare(b.name)));
      setPrinterForm({ name: "", ipAddress: "", port: "9100", stationId: "" });
      setAddingPrinter(false);
    }
  }

  async function updatePrinterStation(printerId: string, stationId: string) {
    const res = await fetch(`/api/tenant/order-printers/${printerId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ stationId: stationId || null }),
    });
    if (res.ok) {
      const { printer } = await res.json();
      setPrinters((prev) => prev.map((p) => (p.id === printerId ? printer : p)));
    }
  }

  async function deletePrinter(printer: PrinterItem) {
    if (!confirm(s.confirmDeletePrinter(printer.name))) return;
    const res = await fetch(`/api/tenant/order-printers/${printer.id}`, { method: "DELETE" });
    if (res.ok) setPrinters((prev) => prev.filter((p) => p.id !== printer.id));
  }

  async function updateCategoryStation(categoryId: string, stationId: string) {
    setSavingRouting(categoryId);
    const res = await fetch("/api/tenant/order-category-routing", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ categoryId, stationId: stationId || null }),
    });
    if (res.ok) {
      const { category } = await res.json();
      setCategories((prev) => prev.map((c) => (c.id === categoryId ? category : c)));
    }
    setSavingRouting(null);
  }

  return (
    <div className="flex flex-col gap-5">
      <DashboardCard>
        <h2 className="text-xl font-semibold mb-1">{s.title}</h2>
        <p className="text-sm text-[#343233]/70 mb-5">{s.subtitle}</p>

        {/* Estaciones */}
        <div className="flex items-center justify-between gap-2 mb-3">
          <h3 className="text-sm font-semibold flex items-center gap-2">
            <ChefHat size={16} aria-hidden /> {s.stationsTitle}
          </h3>
          {!addingStation && (
            <button
              onClick={() => setAddingStation(true)}
              className="flex items-center gap-1.5 text-xs font-semibold px-2.5 h-7 rounded-lg bg-[#F7F8F4] hover:bg-[#eee]"
            >
              <Plus size={13} aria-hidden /> {s.addStation}
            </button>
          )}
        </div>

        <div className="flex flex-wrap gap-2 mb-2">
          {stations.map((st) =>
            editingStationId === st.id ? (
              <input
                key={st.id}
                autoFocus
                defaultValue={st.name}
                onBlur={(e) => renameStation(st.id, e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && renameStation(st.id, (e.target as HTMLInputElement).value)}
                className="text-xs px-2.5 py-1.5 rounded-md border border-[#002D09]/30 outline-none"
              />
            ) : (
              <span
                key={st.id}
                className="flex items-center gap-1.5 text-xs font-medium px-2.5 py-1.5 rounded-md bg-[#F7F8F4]"
              >
                {st.name}
                <button onClick={() => setEditingStationId(st.id)} aria-label={s.stationsTitle} className="hover:opacity-70">
                  <Pencil size={11} aria-hidden />
                </button>
                <button onClick={() => deleteStation(st)} aria-label="delete" className="text-red-600 hover:opacity-70">
                  <Trash2 size={11} aria-hidden />
                </button>
              </span>
            )
          )}
          {stations.length === 0 && !addingStation && <p className="text-xs text-[#343233]/50">{s.noStations}</p>}
        </div>

        {addingStation && (
          <div className="flex gap-2 mb-2">
            <input
              autoFocus
              value={stationName}
              onChange={(e) => setStationName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && createStation()}
              placeholder={s.stationNamePlaceholder}
              className="flex-1 max-w-xs bg-[#F7F8F4] border border-[#002D09]/15 rounded-lg px-3 py-1.5 text-sm outline-none"
            />
            <button
              onClick={createStation}
              className="text-xs font-semibold px-3 h-8 rounded-lg bg-[#E7FF00] text-[#002D09]"
            >
              {t.common.save}
            </button>
            <button
              onClick={() => {
                setAddingStation(false);
                setStationName("");
              }}
              className="text-xs font-medium px-3 h-8 rounded-lg border border-[#002D09]/15"
            >
              {t.common.cancel}
            </button>
          </div>
        )}
      </DashboardCard>

      <DashboardCard>
        <div className="flex items-center justify-between gap-2 mb-1">
          <h3 className="text-sm font-semibold flex items-center gap-2">
            <PrinterIcon size={16} aria-hidden /> {s.printersTitle}
          </h3>
          {!addingPrinter && (
            <button
              onClick={() => setAddingPrinter(true)}
              className="flex items-center gap-1.5 text-xs font-semibold px-2.5 h-7 rounded-lg bg-[#F7F8F4] hover:bg-[#eee]"
            >
              <Plus size={13} aria-hidden /> {s.addPrinter}
            </button>
          )}
        </div>

        {printers.length === 0 && !addingPrinter && <p className="text-xs text-[#343233]/50 mb-2">{s.noPrinters}</p>}

        {printers.length > 0 && (
          <div className="flex flex-col gap-2 mb-3">
            {printers.map((p) => (
              <div key={p.id} className="border border-[#002D09]/10 rounded-lg p-3 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-semibold">{p.name}</p>
                  <p className="text-xs text-[#343233]/60">
                    {p.ipAddress}:{p.port}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <select
                    value={p.stationId ?? ""}
                    onChange={(e) => updatePrinterStation(p.id, e.target.value)}
                    className="text-xs bg-[#F7F8F4] border border-[#002D09]/15 rounded-md px-2 py-1.5 outline-none"
                  >
                    <option value="">{s.noStation}</option>
                    {stations.map((st) => (
                      <option key={st.id} value={st.id}>
                        {st.name}
                      </option>
                    ))}
                  </select>
                  <button onClick={() => deletePrinter(p)} aria-label="delete" className="p-1.5 rounded-md hover:bg-[#F7F8F4] text-red-600">
                    <Trash2 size={14} aria-hidden />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {addingPrinter && (
          <div className="border border-[#002D09]/10 rounded-lg p-3 flex flex-col gap-2">
            <input
              autoFocus
              value={printerForm.name}
              onChange={(e) => setPrinterForm({ ...printerForm, name: e.target.value })}
              placeholder={s.printerNamePlaceholder}
              className="w-full bg-[#F7F8F4] border border-[#002D09]/15 rounded-lg px-3 py-1.5 text-sm outline-none"
            />
            <div className="flex gap-2">
              <input
                value={printerForm.ipAddress}
                onChange={(e) => setPrinterForm({ ...printerForm, ipAddress: e.target.value })}
                placeholder={s.printerIpPlaceholder}
                className="flex-1 bg-[#F7F8F4] border border-[#002D09]/15 rounded-lg px-3 py-1.5 text-sm outline-none"
              />
              <input
                value={printerForm.port}
                onChange={(e) => setPrinterForm({ ...printerForm, port: e.target.value })}
                placeholder={s.printerPortPlaceholder}
                className="w-24 bg-[#F7F8F4] border border-[#002D09]/15 rounded-lg px-3 py-1.5 text-sm outline-none"
              />
            </div>
            <select
              value={printerForm.stationId}
              onChange={(e) => setPrinterForm({ ...printerForm, stationId: e.target.value })}
              className="w-full bg-[#F7F8F4] border border-[#002D09]/15 rounded-lg px-3 py-1.5 text-sm outline-none"
            >
              <option value="">{s.noStation}</option>
              {stations.map((st) => (
                <option key={st.id} value={st.id}>
                  {st.name}
                </option>
              ))}
            </select>
            <div className="flex gap-2 mt-1">
              <button onClick={createPrinter} className="text-xs font-semibold px-3 h-8 rounded-lg bg-[#E7FF00] text-[#002D09]">
                {t.common.save}
              </button>
              <button
                onClick={() => {
                  setAddingPrinter(false);
                  setPrinterForm({ name: "", ipAddress: "", port: "9100", stationId: "" });
                }}
                className="text-xs font-medium px-3 h-8 rounded-lg border border-[#002D09]/15"
              >
                {t.common.cancel}
              </button>
            </div>
          </div>
        )}
      </DashboardCard>

      <DashboardCard>
        <h3 className="text-sm font-semibold mb-1">{s.routingTitle}</h3>
        <p className="text-xs text-[#343233]/70 mb-4">{s.routingSubtitle}</p>

        {categories.length === 0 ? (
          <p className="text-xs text-[#343233]/50">{s.noCategories}</p>
        ) : (
          <div className="flex flex-col gap-2">
            {categories.map((c) => (
              <div key={c.id} className="flex items-center justify-between gap-3 py-1.5">
                <span className="text-sm">{c.name}</span>
                <select
                  value={c.stationId ?? ""}
                  onChange={(e) => updateCategoryStation(c.id, e.target.value)}
                  disabled={savingRouting === c.id}
                  className="text-xs bg-[#F7F8F4] border border-[#002D09]/15 rounded-md px-2 py-1.5 outline-none disabled:opacity-50"
                >
                  <option value="">{s.noStation}</option>
                  {stations.map((st) => (
                    <option key={st.id} value={st.id}>
                      {st.name}
                    </option>
                  ))}
                </select>
              </div>
            ))}
          </div>
        )}
      </DashboardCard>
    </div>
  );
}
