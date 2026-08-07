"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Plus,
  Pencil,
  Trash2,
  X,
  ArrowUp,
  ArrowDown,
  Globe,
  MessageCircle,
  Phone,
  Instagram,
  Facebook,
  Youtube,
  Linkedin,
  MapPin,
  Link2,
  Copy,
  Check,
  Contact,
  MousePointerClick,
} from "lucide-react";

type LinkType =
  | "WEBSITE"
  | "WHATSAPP"
  | "PHONE"
  | "INSTAGRAM"
  | "FACEBOOK"
  | "TIKTOK"
  | "TWITTER"
  | "YOUTUBE"
  | "LINKEDIN"
  | "MAPS"
  | "VCARD"
  | "CUSTOM";

interface SmartLinkItem {
  id: string;
  type: LinkType;
  label: string;
  value: string | null;
  sortOrder: number;
  clickCount: number;
}

const TYPE_META: Record<LinkType, { label: string; icon: any; placeholder: string; helper: string }> = {
  WEBSITE: { label: "Sitio web", icon: Globe, placeholder: "https://tunegocio.com", helper: "URL completa" },
  WHATSAPP: { label: "WhatsApp", icon: MessageCircle, placeholder: "521234567890", helper: "Solo números, con código de país, sin +" },
  PHONE: { label: "Teléfono", icon: Phone, placeholder: "+1 555 123 4567", helper: "Como quieres que se marque" },
  INSTAGRAM: { label: "Instagram", icon: Instagram, placeholder: "https://instagram.com/tu_usuario", helper: "URL completa del perfil" },
  FACEBOOK: { label: "Facebook", icon: Facebook, placeholder: "https://facebook.com/tupagina", helper: "URL completa de la página" },
  TIKTOK: { label: "TikTok", icon: Link2, placeholder: "https://tiktok.com/@tu_usuario", helper: "URL completa del perfil" },
  TWITTER: { label: "X / Twitter", icon: Link2, placeholder: "https://x.com/tu_usuario", helper: "URL completa del perfil" },
  YOUTUBE: { label: "YouTube", icon: Youtube, placeholder: "https://youtube.com/@tucanal", helper: "URL completa del canal" },
  LINKEDIN: { label: "LinkedIn", icon: Linkedin, placeholder: "https://linkedin.com/company/tunegocio", helper: "URL completa del perfil" },
  MAPS: { label: "Ubicación (Maps)", icon: MapPin, placeholder: "https://maps.app.goo.gl/...", helper: "Copia el link de 'Compartir' desde Google Maps" },
  VCARD: { label: "Guardar contacto (vCard)", icon: Contact, placeholder: "", helper: "Usa el correo, teléfono y dirección de Ajustes — no necesitas escribir nada aquí" },
  CUSTOM: { label: "Link personalizado", icon: Link2, placeholder: "https://...", helper: "Cualquier URL" },
};

export default function SmartLinkEditor({
  tenant,
  initialItems,
  viewsLast7Days,
}: {
  tenant: { name: string; slug: string; logoUrl: string | null };
  initialItems: SmartLinkItem[];
  viewsLast7Days: number;
}) {
  const [items, setItems] = useState(initialItems);
  const [modal, setModal] = useState<{ mode: "create" | "edit"; item?: SmartLinkItem } | null>(null);
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);

  const publicUrl =
    typeof window !== "undefined" ? `${window.location.origin}/link/${tenant.slug}` : `/link/${tenant.slug}`;

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(publicUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // clipboard puede fallar en algunos navegadores/permiso — no es crítico
    }
  }

  async function deleteItem(item: SmartLinkItem) {
    if (!confirm(`¿Borrar "${item.label}"?`)) return;
    setBusy(item.id);
    const res = await fetch(`/api/smartlink-items/${item.id}`, { method: "DELETE" });
    if (res.ok) setItems((prev) => prev.filter((i) => i.id !== item.id));
    setBusy(null);
  }

  async function move(item: SmartLinkItem, direction: -1 | 1) {
    const sorted = [...items].sort((a, b) => a.sortOrder - b.sortOrder);
    const idx = sorted.findIndex((i) => i.id === item.id);
    const swapIdx = idx + direction;
    if (swapIdx < 0 || swapIdx >= sorted.length) return;

    [sorted[idx], sorted[swapIdx]] = [sorted[swapIdx], sorted[idx]];
    const reordered = sorted.map((i, index) => ({ ...i, sortOrder: index }));
    setItems(reordered);

    await fetch("/api/smartlink-items/reorder", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orderedIds: reordered.map((i) => i.id) }),
    });
  }

  const sortedItems = [...items].sort((a, b) => a.sortOrder - b.sortOrder);

  return (
    <div className="max-w-lg">
      <div className="flex flex-wrap items-start justify-between gap-3 mb-1">
        <h1 className="text-xl font-semibold">Tu Smartlink</h1>
        <button
          onClick={() => setModal({ mode: "create" })}
          className="flex items-center gap-1.5 text-sm font-medium bg-[#E7FF00] text-[#002D09] px-3.5 h-9 rounded-lg hover:brightness-105"
        >
          <Plus size={16} aria-hidden />
          Agregar link
        </button>
      </div>
      <p className="text-sm text-[#343233]/70 mb-4">
        Foto y nombre se editan en{" "}
        <Link href="/dashboard/settings" className="underline hover:text-[#002D09]">
          Ajustes
        </Link>
        .
      </p>

      <div className="flex items-center gap-2 bg-[#F7F8F4] rounded-lg px-3 py-2 mb-6">
        <span className="text-sm text-[#002D09] truncate flex-1">{publicUrl}</span>
        <button onClick={copyLink} className="text-[#343233]/70 hover:text-[#002D09] shrink-0">
          {copied ? <Check size={15} aria-hidden /> : <Copy size={15} aria-hidden />}
        </button>
      </div>

      <div className="grid grid-cols-2 gap-3 mb-6">
        <StatCard label="Vistas (7 días)" value={viewsLast7Days} />
        <StatCard label="Clics totales" value={items.reduce((sum, i) => sum + i.clickCount, 0)} />
      </div>

      {sortedItems.length === 0 && (
        <p className="text-sm text-[#343233]/60">Todavía no tienes links. Agrega el primero.</p>
      )}

      <div className="flex flex-col gap-2">
        {sortedItems.map((item, idx) => {
          const meta = TYPE_META[item.type];
          const Icon = meta.icon;
          return (
            <div
              key={item.id}
              className="flex flex-wrap items-center gap-x-3 gap-y-2 border border-[#002D09]/10 rounded-lg px-3.5 py-2.5"
            >
              <div className="flex items-center gap-3 flex-1 min-w-[140px]">
                <Icon size={16} className="text-[#343233]/70 shrink-0" aria-hidden />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{item.label}</p>
                  <p className="text-xs text-[#343233]/60 truncate">{meta.label}</p>
                </div>
              </div>
              <div className="flex items-center gap-2 ml-auto">
              <span className="flex items-center gap-1 text-xs text-[#343233]/50 shrink-0">
                <MousePointerClick size={12} aria-hidden />
                {item.clickCount}
              </span>
              <div className="flex items-center gap-1 shrink-0">
                <button
                  onClick={() => move(item, -1)}
                  disabled={idx === 0}
                  aria-label="Mover arriba"
                  className="text-[#343233]/60 hover:text-[#002D09] disabled:opacity-30"
                >
                  <ArrowUp size={14} aria-hidden />
                </button>
                <button
                  onClick={() => move(item, 1)}
                  disabled={idx === sortedItems.length - 1}
                  aria-label="Mover abajo"
                  className="text-[#343233]/60 hover:text-[#002D09] disabled:opacity-30"
                >
                  <ArrowDown size={14} aria-hidden />
                </button>
                <button
                  onClick={() => setModal({ mode: "edit", item })}
                  aria-label={`Editar ${item.label}`}
                  className="text-[#343233]/60 hover:text-[#002D09] ml-1"
                >
                  <Pencil size={14} aria-hidden />
                </button>
                <button
                  onClick={() => deleteItem(item)}
                  disabled={busy === item.id}
                  aria-label={`Borrar ${item.label}`}
                  className="text-[#343233]/60 hover:text-red-600"
                >
                  <Trash2 size={14} aria-hidden />
                </button>
              </div>
              </div>
            </div>
          );
        })}
      </div>

      {modal && (
        <LinkModal
          mode={modal.mode}
          item={modal.item}
          onClose={() => setModal(null)}
          onCreated={(item) => setItems((prev) => [...prev, item])}
          onUpdated={(item) => setItems((prev) => prev.map((i) => (i.id === item.id ? item : i)))}
        />
      )}
    </div>
  );
}

function LinkModal({
  mode,
  item,
  onClose,
  onCreated,
  onUpdated,
}: {
  mode: "create" | "edit";
  item?: SmartLinkItem;
  onClose: () => void;
  onCreated: (item: SmartLinkItem) => void;
  onUpdated: (item: SmartLinkItem) => void;
}) {
  const [type, setType] = useState<LinkType>(item?.type ?? "WEBSITE");
  const [label, setLabel] = useState(item?.label ?? TYPE_META[item?.type ?? "WEBSITE"].label);
  const [value, setValue] = useState(item?.value ?? "");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const meta = TYPE_META[type];

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);

    try {
      const url = mode === "create" ? "/api/smartlink-items" : `/api/smartlink-items/${item!.id}`;
      const method = mode === "create" ? "POST" : "PATCH";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(mode === "create" ? { type, label, value } : { label, value }),
      });

      if (!res.ok) {
        let message = "No se pudo guardar el link";
        try {
          const body = await res.json();
          if (typeof body.error === "string") message = body.error;
        } catch {}
        setError(message);
        setSaving(false);
        return;
      }

      const { item: saved } = await res.json();
      if (mode === "create") onCreated(saved);
      else onUpdated(saved);
      onClose();
    } catch {
      setError("No se pudo conectar con el servidor. Intenta de nuevo.");
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 px-4">
      <div className="bg-white border border-[#002D09]/10 rounded-xl w-full max-w-sm p-5 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold">{mode === "create" ? "Agregar link" : "Editar link"}</h2>
          <button onClick={onClose} aria-label="Cerrar" className="text-[#343233]/60 hover:text-[#002D09]">
            <X size={18} aria-hidden />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          {mode === "create" && (
            <label className="flex flex-col gap-1">
              <span className="text-xs text-[#343233]/70">Tipo</span>
              <select
                value={type}
                onChange={(e) => {
                  const t = e.target.value as LinkType;
                  setType(t);
                  setLabel(TYPE_META[t].label);
                }}
                className={inputClass}
              >
                {(Object.keys(TYPE_META) as LinkType[]).map((t) => (
                  <option key={t} value={t}>
                    {TYPE_META[t].label}
                  </option>
                ))}
              </select>
            </label>
          )}

          <label className="flex flex-col gap-1">
            <span className="text-xs text-[#343233]/70">Nombre a mostrar</span>
            <input value={label} onChange={(e) => setLabel(e.target.value)} required className={inputClass} />
          </label>

          <label className="flex flex-col gap-1">
            <span className="text-xs text-[#343233]/70">{meta.helper}</span>
            {type !== "VCARD" && (
              <input
                value={value}
                onChange={(e) => setValue(e.target.value)}
                required
                placeholder={meta.placeholder}
                className={inputClass}
              />
            )}
          </label>

          {error && <p className="text-red-600 text-sm">{error}</p>}

          <div className="flex gap-2 mt-1">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2 rounded-lg border border-[#002D09]/15 text-sm hover:bg-[#F7F8F4]"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex-1 py-2 rounded-lg bg-[#E7FF00] text-[#002D09] text-sm font-medium hover:brightness-105 disabled:opacity-50"
            >
              {saving ? "Guardando..." : mode === "create" ? "Agregar" : "Guardar"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

const inputClass =
  "w-full bg-[#F7F8F4] border border-[#002D09]/15 rounded-lg px-3 py-2 text-sm outline-none focus:border-[#002D09]/40";

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="bg-[#F7F8F4] rounded-lg p-4">
      <p className="text-sm text-[#343233]/70">{label}</p>
      <p className="text-2xl font-semibold mt-1">{value}</p>
    </div>
  );
}
