"use client";

import { useState } from "react";
import { Megaphone, Plus, Pencil, Trash2, Upload } from "lucide-react";
import DashboardCard from "@/components/dashboard-card";
import { uploadImage } from "@/lib/upload-image";

interface Popup {
  id: string;
  title: string;
  imageUrl: string;
  tenantSlug: string | null;
  linkUrl: string | null;
  active: boolean;
  startsAt: string | null;
  endsAt: string | null;
  createdAt: string;
}

interface TenantOption {
  slug: string;
  name: string;
}

type Status = "live" | "scheduled" | "expired" | "off";

function statusOf(p: Popup, now = Date.now()): Status {
  if (!p.active) return "off";
  if (p.startsAt && new Date(p.startsAt).getTime() > now) return "scheduled";
  if (p.endsAt && new Date(p.endsAt).getTime() < now) return "expired";
  return "live";
}

const STATUS_LABEL: Record<Status, string> = {
  live: "Vigente",
  scheduled: "Programado",
  expired: "Vencido",
  off: "Apagado",
};

const inputClass = "w-full px-3 py-2 rounded-lg border border-[#343233]/15 text-sm";

function toLocalInput(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function formatDate(iso: string | null) {
  return iso ? new Date(iso).toLocaleString("es", { dateStyle: "medium", timeStyle: "short" }) : null;
}

export default function PopupsView({ initialPopups, tenants }: { initialPopups: Popup[]; tenants: TenantOption[] }) {
  const [popups, setPopups] = useState(initialPopups);
  const [editing, setEditing] = useState<Popup | "new" | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Si hay varios vigentes, la app muestra el más reciente.
  const winnerId = popups
    .filter((p) => statusOf(p) === "live")
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0]?.id;

  async function toggle(p: Popup) {
    setBusyId(p.id);
    setError(null);
    const res = await fetch(`/api/admin/popups/${p.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ active: !p.active }),
    });
    if (res.ok) setPopups((prev) => prev.map((x) => (x.id === p.id ? { ...x, active: !p.active } : x)));
    else setError("No se pudo actualizar. Intenta de nuevo.");
    setBusyId(null);
  }

  async function remove(p: Popup) {
    if (!window.confirm(`¿Eliminar el pop-up «${p.title}»?`)) return;
    setBusyId(p.id);
    setError(null);
    const res = await fetch(`/api/admin/popups/${p.id}`, { method: "DELETE" });
    if (res.ok) setPopups((prev) => prev.filter((x) => x.id !== p.id));
    else setError("No se pudo eliminar. Intenta de nuevo.");
    setBusyId(null);
  }

  function saved(p: Popup) {
    setPopups((prev) => (prev.some((x) => x.id === p.id) ? prev.map((x) => (x.id === p.id ? p : x)) : [p, ...prev]));
    setEditing(null);
  }

  return (
    <div className="flex flex-col gap-5">
      <DashboardCard>
        <div className="flex items-start justify-between gap-4 mb-1">
          <h1 className="text-xl font-semibold flex items-center gap-2">
            <Megaphone size={20} aria-hidden />
            Pop-up de la app
          </h1>
          <button
            onClick={() => setEditing("new")}
            className="flex items-center gap-1.5 text-sm font-semibold px-3 py-2 rounded-lg bg-[#E7FF00] text-[#002D09] hover:brightness-105 shrink-0"
          >
            <Plus size={15} aria-hidden />
            Nuevo pop-up
          </button>
        </div>
        <p className="text-sm text-[#343233]/70 mb-6">
          Espacio publicitario que aparece al abrir la app de Zertoo Eats. Solo tú puedes activarlo. Si hay varios
          vigentes a la vez, la app muestra el más reciente, una vez por sesión.
        </p>

        {error && <p className="text-red-600 text-sm mb-3">{error}</p>}
        {popups.length === 0 && <p className="text-sm text-[#343233]/60">Todavía no hay pop-ups creados.</p>}

        <div className="border border-[#002D09]/10 rounded-lg overflow-hidden divide-y divide-[#002D09]/10">
          {popups.map((p) => {
            const status = statusOf(p);
            const target = p.tenantSlug
              ? `Abre: ${tenants.find((t) => t.slug === p.tenantSlug)?.name ?? p.tenantSlug}`
              : p.linkUrl
                ? `Enlace: ${p.linkUrl}`
                : "Solo imagen";
            return (
              <div key={p.id} className="flex items-center gap-3 px-4 py-3">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={p.imageUrl} alt="" className="w-12 h-[60px] rounded-md object-cover bg-black/5 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{p.title}</p>
                  <p className="text-xs text-[#343233]/60 truncate">{target}</p>
                  {(p.startsAt || p.endsAt) && (
                    <p className="text-xs text-[#343233]/50">
                      {formatDate(p.startsAt) ?? "Ya"} → {formatDate(p.endsAt) ?? "sin fecha de fin"}
                    </p>
                  )}
                </div>
                <span
                  className={`text-[11px] font-semibold px-2 py-1 rounded-md shrink-0 ${
                    p.id === winnerId
                      ? "bg-[#E7FF00] text-[#002D09]"
                      : status === "live"
                        ? "bg-[#343233]/10 text-[#343233]/70"
                        : status === "scheduled"
                          ? "bg-amber-100 text-amber-800"
                          : "bg-[#343233]/5 text-[#343233]/50"
                  }`}
                >
                  {p.id === winnerId ? "En vivo ahora" : status === "live" ? "Vigente (en cola)" : STATUS_LABEL[status]}
                </span>
                <button
                  onClick={() => toggle(p)}
                  disabled={busyId === p.id}
                  className="text-xs font-semibold px-3 py-1.5 rounded-md border border-[#002D09]/15 hover:bg-[#F7F8F4] disabled:opacity-50 shrink-0"
                >
                  {p.active ? "Apagar" : "Activar"}
                </button>
                <button onClick={() => setEditing(p)} aria-label={`Editar ${p.title}`} className="p-1.5 text-[#343233]/60 hover:text-[#002D09]">
                  <Pencil size={15} aria-hidden />
                </button>
                <button onClick={() => remove(p)} disabled={busyId === p.id} aria-label={`Eliminar ${p.title}`} className="p-1.5 text-[#343233]/60 hover:text-red-600 disabled:opacity-50">
                  <Trash2 size={15} aria-hidden />
                </button>
              </div>
            );
          })}
        </div>
      </DashboardCard>

      {editing && <PopupForm popup={editing === "new" ? null : editing} tenants={tenants} onClose={() => setEditing(null)} onSaved={saved} />}
    </div>
  );
}

function PopupForm({
  popup,
  tenants,
  onClose,
  onSaved,
}: {
  popup: Popup | null;
  tenants: TenantOption[];
  onClose: () => void;
  onSaved: (p: Popup) => void;
}) {
  const [title, setTitle] = useState(popup?.title ?? "");
  const [imageUrl, setImageUrl] = useState(popup?.imageUrl ?? "");
  const [target, setTarget] = useState<"none" | "tenant" | "url">(popup?.tenantSlug ? "tenant" : popup?.linkUrl ? "url" : "none");
  const [tenantSlug, setTenantSlug] = useState(popup?.tenantSlug ?? tenants[0]?.slug ?? "");
  const [linkUrl, setLinkUrl] = useState(popup?.linkUrl ?? "");
  const [startsAt, setStartsAt] = useState(toLocalInput(popup?.startsAt ?? null));
  const [endsAt, setEndsAt] = useState(toLocalInput(popup?.endsAt ?? null));
  const [active, setActive] = useState(popup?.active ?? false);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setUploading(true);
    setError(null);
    try {
      setImageUrl(await uploadImage(file, 1080, "jpeg", "/api/admin/popups/presign"));
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo subir la imagen.");
    } finally {
      setUploading(false);
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!imageUrl) return setError("Sube la imagen del pop-up.");
    if (startsAt && endsAt && new Date(endsAt) <= new Date(startsAt)) return setError("La fecha de fin debe ser posterior a la de inicio.");
    setSaving(true);
    setError(null);
    const res = await fetch(popup ? `/api/admin/popups/${popup.id}` : "/api/admin/popups", {
      method: popup ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title,
        imageUrl,
        tenantSlug: target === "tenant" ? tenantSlug : null,
        linkUrl: target === "url" ? linkUrl : null,
        active,
        startsAt: startsAt ? new Date(startsAt).toISOString() : null,
        endsAt: endsAt ? new Date(endsAt).toISOString() : null,
      }),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => null);
      setError(typeof body?.error === "string" ? body.error : "No se pudo guardar.");
      setSaving(false);
      return;
    }
    const { popup: saved } = await res.json();
    onSaved({
      ...saved,
      startsAt: saved.startsAt ?? null,
      endsAt: saved.endsAt ?? null,
      createdAt: typeof saved.createdAt === "string" ? saved.createdAt : new Date(saved.createdAt).toISOString(),
    });
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 px-4" role="dialog" aria-modal="true">
      <form onSubmit={submit} className="max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-xl bg-white p-5 flex flex-col gap-3">
        <h2 className="text-base font-semibold">{popup ? "Editar pop-up" : "Nuevo pop-up"}</h2>

        <label className="flex flex-col gap-1">
          <span className="text-xs text-[#343233]/70">Nombre interno (anunciante o campaña)</span>
          <input value={title} onChange={(e) => setTitle(e.target.value)} required maxLength={80} className={inputClass} placeholder="Ej. Buffalo Quarters — noviembre" />
        </label>

        <div>
          <span className="text-xs text-[#343233]/70">Imagen (vertical 4:5, recomendado 1080 × 1350 px)</span>
          <div className="mt-1 flex items-center gap-3">
            {imageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={imageUrl} alt="Vista previa" className="w-24 aspect-[4/5] rounded-lg object-cover bg-black/5" />
            ) : (
              <div className="w-24 aspect-[4/5] rounded-lg bg-[#F7F8F4] border border-dashed border-[#343233]/20" />
            )}
            <label className="flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-lg border border-[#002D09]/15 hover:bg-[#F7F8F4] cursor-pointer">
              <Upload size={14} aria-hidden />
              {uploading ? "Subiendo…" : imageUrl ? "Cambiar imagen" : "Subir imagen"}
              <input type="file" accept="image/jpeg,image/png,image/webp" onChange={onFile} disabled={uploading} className="hidden" />
            </label>
          </div>
        </div>

        <label className="flex flex-col gap-1">
          <span className="text-xs text-[#343233]/70">Al tocar el pop-up</span>
          <select value={target} onChange={(e) => setTarget(e.target.value as typeof target)} className={inputClass}>
            <option value="none">Nada (solo la imagen)</option>
            <option value="tenant">Abrir un negocio dentro de la app</option>
            <option value="url">Abrir un enlace externo</option>
          </select>
        </label>
        {target === "tenant" && (
          <select value={tenantSlug} onChange={(e) => setTenantSlug(e.target.value)} className={inputClass} aria-label="Negocio">
            {tenants.map((t) => (
              <option key={t.slug} value={t.slug}>
                {t.name}
              </option>
            ))}
          </select>
        )}
        {target === "url" && (
          <input type="url" value={linkUrl} onChange={(e) => setLinkUrl(e.target.value)} required placeholder="https://" className={inputClass} aria-label="Enlace" />
        )}

        <div className="grid grid-cols-2 gap-3">
          <label className="flex flex-col gap-1">
            <span className="text-xs text-[#343233]/70">Inicio (opcional)</span>
            <input type="datetime-local" value={startsAt} onChange={(e) => setStartsAt(e.target.value)} className={inputClass} />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-xs text-[#343233]/70">Fin (opcional)</span>
            <input type="datetime-local" value={endsAt} onChange={(e) => setEndsAt(e.target.value)} className={inputClass} />
          </label>
        </div>

        <label className="flex items-center gap-2 text-sm cursor-pointer">
          <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} />
          Activo (se muestra en la app dentro de sus fechas)
        </label>

        {error && <p className="text-red-600 text-sm">{error}</p>}
        <div className="flex justify-end gap-2 pt-1">
          <button type="button" onClick={onClose} disabled={saving} className="text-sm px-4 py-2 rounded-lg border border-[#343233]/15">
            Cancelar
          </button>
          <button type="submit" disabled={saving || uploading} className="text-sm font-semibold px-4 py-2 rounded-lg bg-[#E7FF00] text-[#002D09] disabled:opacity-50">
            {saving ? "Guardando…" : "Guardar"}
          </button>
        </div>
      </form>
    </div>
  );
}
