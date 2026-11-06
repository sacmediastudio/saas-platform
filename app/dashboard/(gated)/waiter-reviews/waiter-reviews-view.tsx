"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowDown, ArrowUp, Camera, ExternalLink, MapPin, Star, Trash2 } from "lucide-react";
import DashboardCard from "@/components/dashboard-card";
import BusinessHoursEditor from "@/components/business-hours-editor";
import { useDashboardLang } from "@/lib/dashboard-lang-context";
import { uploadImage } from "@/lib/upload-image";
import {
  WAITER_REVIEW_RADIUS_MAX,
  WAITER_REVIEW_RADIUS_MIN,
  type WaiterReviewSettings,
} from "@/lib/waiter-reviews-shared";

interface WaiterRow {
  id: string;
  name: string;
  photoUrl: string | null;
  isActive: boolean;
  avg: number | null;
  count: number;
  avg30: number | null;
  count30: number;
}

interface RecentReview {
  id: string;
  waiterName: string;
  rating: number;
  note: string | null;
  createdAt: string;
}

const GRACE_OPTIONS = [0, 30, 60, 120, 180, 240];

function Avatar({ name, url, size = 44 }: { name: string; url: string | null; size?: number }) {
  return url ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={url} alt="" style={{ width: size, height: size }} className="rounded-full object-cover shrink-0" />
  ) : (
    <div
      style={{ width: size, height: size }}
      className="rounded-full bg-[#F7F8F4] flex items-center justify-center shrink-0 text-sm font-bold text-[#343233]/60"
    >
      {name.charAt(0).toUpperCase()}
    </div>
  );
}

export default function WaiterReviewsView({
  initialSettings,
  initialWaiters,
  recentReviews,
  timezone,
}: {
  initialSettings: WaiterReviewSettings;
  initialWaiters: WaiterRow[];
  recentReviews: RecentReview[];
  timezone: string;
}) {
  const { t, lang } = useDashboardLang();
  const w = t.waiterReviews;
  const router = useRouter();

  const [settings, setSettings] = useState(initialSettings);
  const [waiters, setWaiters] = useState(initialWaiters);
  const [error, setError] = useState<string | null>(null);
  const [locating, setLocating] = useState(false);
  const [radiusDraft, setRadiusDraft] = useState(String(initialSettings.radiusM));

  const [newName, setNewName] = useState("");
  const [newPhoto, setNewPhoto] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [adding, setAdding] = useState(false);
  const photoInput = useRef<HTMLInputElement>(null);
  const replaceInput = useRef<HTMLInputElement>(null);
  const replaceTarget = useRef<string | null>(null);

  const hasPin = settings.latitude !== null && settings.longitude !== null;

  async function patchSettings(body: Record<string, unknown>) {
    setError(null);
    const res = await fetch("/api/tenant/waiter-reviews/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(typeof data.error === "string" ? data.error : w.saveError);
      return false;
    }
    setSettings(data);
    setRadiusDraft(String(data.radiusM));
    return true;
  }

  function useMyLocation() {
    if (!navigator.geolocation) {
      setError(w.locationFailed);
      return;
    }
    setLocating(true);
    setError(null);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        await patchSettings({ latitude: pos.coords.latitude, longitude: pos.coords.longitude });
        setLocating(false);
      },
      (err) => {
        setError(err.code === err.PERMISSION_DENIED ? w.locationDenied : w.locationFailed);
        setLocating(false);
      },
      { enableHighAccuracy: true, timeout: 20_000, maximumAge: 0 }
    );
  }

  function commitRadius() {
    const n = Math.round(Number(radiusDraft));
    const clamped = Math.min(WAITER_REVIEW_RADIUS_MAX, Math.max(WAITER_REVIEW_RADIUS_MIN, Number.isFinite(n) ? n : 100));
    setRadiusDraft(String(clamped));
    if (clamped !== settings.radiusM) patchSettings({ radiusM: clamped });
  }

  async function pickPhoto(file: File): Promise<string | null> {
    setUploading(true);
    setError(null);
    try {
      return await uploadImage(file, 400);
    } catch (e) {
      setError(e instanceof Error ? e.message : w.saveError);
      return null;
    } finally {
      setUploading(false);
    }
  }

  async function addWaiter() {
    if (!newName.trim()) return;
    setAdding(true);
    setError(null);
    const res = await fetch("/api/tenant/waiters", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newName.trim(), photoUrl: newPhoto }),
    });
    const data = await res.json().catch(() => ({}));
    setAdding(false);
    if (!res.ok) {
      setError(typeof data.error === "string" ? data.error : w.saveError);
      return;
    }
    setWaiters((prev) => [
      ...prev,
      { id: data.waiter.id, name: data.waiter.name, photoUrl: data.waiter.photoUrl, isActive: true, avg: null, count: 0, avg30: null, count30: 0 },
    ]);
    setNewName("");
    setNewPhoto(null);
  }

  async function updateWaiter(id: string, patch: Partial<Pick<WaiterRow, "isActive" | "photoUrl">>) {
    const res = await fetch(`/api/tenant/waiters/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    if (!res.ok) {
      setError(w.saveError);
      return;
    }
    setWaiters((prev) => prev.map((x) => (x.id === id ? { ...x, ...patch } : x)));
  }

  async function removeWaiter(row: WaiterRow) {
    if (!window.confirm(w.removeConfirm(row.name))) return;
    const res = await fetch(`/api/tenant/waiters/${row.id}`, { method: "DELETE" });
    if (!res.ok) {
      setError(w.saveError);
      return;
    }
    setWaiters((prev) => prev.filter((x) => x.id !== row.id));
    router.refresh();
  }

  async function move(index: number, dir: -1 | 1) {
    const target = index + dir;
    if (target < 0 || target >= waiters.length) return;
    const next = [...waiters];
    [next[index], next[target]] = [next[target], next[index]];
    setWaiters(next);
    const res = await fetch("/api/tenant/waiters/reorder", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids: next.map((x) => x.id) }),
    });
    if (!res.ok) {
      setWaiters(waiters);
      setError(w.saveError);
    }
  }

  async function deleteReview(id: string) {
    if (!window.confirm(w.deleteReviewConfirm)) return;
    const res = await fetch(`/api/tenant/waiter-reviews/${id}`, { method: "DELETE" });
    if (res.ok) router.refresh();
    else setError(w.saveError);
  }

  const dateFmt = new Intl.DateTimeFormat(lang === "es" ? "es" : "en", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: timezone,
  });

  const canEnable = hasPin && settings.hasHours;

  return (
    <div className="max-w-3xl">
      <h1 className="text-2xl font-bold text-[#343233]">{w.title}</h1>
      <p className="text-sm text-[#343233]/60 mt-1 mb-6">{w.subtitle}</p>

      {error && <p className="text-red-600 text-sm mb-4" role="alert">{error}</p>}

      <DashboardCard className="mb-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="font-semibold text-[#343233]">{w.enableTitle}</h2>
            <p className="text-sm text-[#343233]/60 mt-1">{w.enableHint}</p>
            {!settings.enabled && !canEnable && (
              <p className="text-xs text-amber-700 mt-2">{!hasPin ? w.needPin : w.needHours}</p>
            )}
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={settings.enabled}
            aria-label={w.enableTitle}
            disabled={!settings.enabled && !canEnable}
            onClick={() => patchSettings({ enabled: !settings.enabled })}
            className={`relative h-7 w-12 shrink-0 rounded-full transition-colors disabled:opacity-40 ${
              settings.enabled ? "bg-[#002D09]" : "bg-[#343233]/25"
            }`}
          >
            <span
              className={`absolute top-0.5 h-6 w-6 rounded-full bg-white shadow transition-all ${
                settings.enabled ? "left-[22px]" : "left-0.5"
              }`}
            />
          </button>
        </div>

        <div className="grid sm:grid-cols-2 gap-4 mt-6">
          <label className="flex flex-col gap-1.5">
            <span className="text-xs text-[#343233]/70">{w.radiusLabel}</span>
            <input
              type="number"
              inputMode="numeric"
              min={WAITER_REVIEW_RADIUS_MIN}
              max={WAITER_REVIEW_RADIUS_MAX}
              step={10}
              value={radiusDraft}
              onChange={(e) => setRadiusDraft(e.target.value)}
              onBlur={commitRadius}
              className="bg-[#F7F8F4] border border-[#002D09]/15 rounded-lg px-3 py-2 text-sm outline-none"
            />
            <span className="text-xs text-[#343233]/50">{w.radiusHint}</span>
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-xs text-[#343233]/70">{w.graceLabel}</span>
            <select
              value={settings.graceMinutes}
              onChange={(e) => patchSettings({ graceMinutes: Number(e.target.value) })}
              className="bg-[#F7F8F4] border border-[#002D09]/15 rounded-lg px-3 py-2 text-sm outline-none"
            >
              {GRACE_OPTIONS.map((m) => (
                <option key={m} value={m}>
                  {w.graceOptions(m)}
                </option>
              ))}
            </select>
          </label>
        </div>
      </DashboardCard>

      <DashboardCard className="mb-5">
        <h2 className="font-semibold text-[#343233] flex items-center gap-2">
          <MapPin size={16} aria-hidden /> {w.locationTitle}
        </h2>
        <p className="text-sm text-[#343233]/60 mt-1">{w.locationHint}</p>
        <p className="text-sm mt-3 text-[#343233]">
          {hasPin ? (
            <>
              <span className="font-mono">
                {settings.latitude!.toFixed(5)}, {settings.longitude!.toFixed(5)}
              </span>{" "}
              <a
                href={`https://www.google.com/maps?q=${settings.latitude},${settings.longitude}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-[#002D09] underline underline-offset-2 ml-2"
              >
                {w.viewOnMap} <ExternalLink size={12} aria-hidden />
              </a>
            </>
          ) : (
            <span className="text-[#343233]/50">{w.locationNone}</span>
          )}
        </p>
        <div className="flex flex-wrap gap-2 mt-4">
          <button
            type="button"
            onClick={useMyLocation}
            disabled={locating}
            className="px-4 py-2 rounded-full bg-[#002D09] text-white text-sm font-semibold disabled:opacity-60"
          >
            {locating ? w.gettingLocation : w.useMyLocation}
          </button>
          {settings.hasAddress && settings.geocodingAvailable && (
            <button
              type="button"
              onClick={() => patchSettings({ geocodeAddress: true })}
              className="px-4 py-2 rounded-full border border-[#002D09]/25 text-sm font-semibold text-[#002D09]"
            >
              {w.useAddress}
            </button>
          )}
        </div>
      </DashboardCard>

      <DashboardCard className="mb-5">
        <h2 className="font-semibold text-[#343233]">{w.hoursTitle}</h2>
        <p className="text-sm text-[#343233]/60 mt-1 mb-4">{w.hoursHint}</p>
        <BusinessHoursEditor hideBuffer />
      </DashboardCard>

      <DashboardCard className="mb-5">
        <h2 className="font-semibold text-[#343233]">{w.waitersTitle}</h2>

        {waiters.length === 0 ? (
          <p className="text-sm text-[#343233]/60 mt-3">{w.waitersEmpty}</p>
        ) : (
          <ul className="mt-4 divide-y divide-black/[0.06]">
            {waiters.map((row, i) => (
              <li key={row.id} className="py-3 flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => {
                    replaceTarget.current = row.id;
                    replaceInput.current?.click();
                  }}
                  aria-label={w.changePhoto}
                  title={w.changePhoto}
                  className="relative shrink-0"
                >
                  <Avatar name={row.name} url={row.photoUrl} />
                  <span className="absolute -bottom-1 -right-1 rounded-full bg-white border border-black/10 p-1">
                    <Camera size={10} aria-hidden />
                  </span>
                </button>
                <div className="min-w-0 flex-1">
                  <p className={`font-medium truncate ${row.isActive ? "text-[#343233]" : "text-[#343233]/40"}`}>{row.name}</p>
                  <p className="text-xs text-[#343233]/50">
                    {row.isActive ? w.active : w.inactive}
                  </p>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={row.isActive}
                  aria-label={`${row.name}: ${row.isActive ? w.active : w.inactive}`}
                  onClick={() => updateWaiter(row.id, { isActive: !row.isActive })}
                  className={`relative h-6 w-10 shrink-0 rounded-full transition-colors ${
                    row.isActive ? "bg-[#002D09]" : "bg-[#343233]/25"
                  }`}
                >
                  <span
                    className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${
                      row.isActive ? "left-[18px]" : "left-0.5"
                    }`}
                  />
                </button>
                <button type="button" onClick={() => move(i, -1)} disabled={i === 0} aria-label={w.moveUp} className="p-1.5 rounded-md hover:bg-black/5 disabled:opacity-30">
                  <ArrowUp size={16} aria-hidden />
                </button>
                <button type="button" onClick={() => move(i, 1)} disabled={i === waiters.length - 1} aria-label={w.moveDown} className="p-1.5 rounded-md hover:bg-black/5 disabled:opacity-30">
                  <ArrowDown size={16} aria-hidden />
                </button>
                <button type="button" onClick={() => removeWaiter(row)} aria-label={`${w.remove} ${row.name}`} className="p-1.5 rounded-md text-red-600 hover:bg-red-50">
                  <Trash2 size={16} aria-hidden />
                </button>
              </li>
            ))}
          </ul>
        )}

        <input
          ref={replaceInput}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={async (e) => {
            const file = e.target.files?.[0];
            const id = replaceTarget.current;
            e.target.value = "";
            if (!file || !id) return;
            const url = await pickPhoto(file);
            if (url) await updateWaiter(id, { photoUrl: url });
          }}
        />

        <div className="mt-5 pt-5 border-t border-black/[0.06] flex flex-wrap items-end gap-3">
          <button
            type="button"
            onClick={() => photoInput.current?.click()}
            disabled={uploading}
            aria-label={newPhoto ? w.changePhoto : w.addPhoto}
            className="shrink-0"
          >
            {newPhoto ? (
              <Avatar name={newName || "?"} url={newPhoto} size={48} />
            ) : (
              <span className="flex h-12 w-12 items-center justify-center rounded-full border border-dashed border-[#002D09]/30 text-[#002D09]/60">
                <Camera size={18} aria-hidden />
              </span>
            )}
          </button>
          <input
            ref={photoInput}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={async (e) => {
              const file = e.target.files?.[0];
              e.target.value = "";
              if (!file) return;
              const url = await pickPhoto(file);
              if (url) setNewPhoto(url);
            }}
          />
          <label className="flex flex-col gap-1.5 flex-1 min-w-[160px]">
            <span className="text-xs text-[#343233]/70">{w.nameLabel}</span>
            <input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              maxLength={60}
              placeholder={w.namePlaceholder}
              onKeyDown={(e) => {
                if (e.key === "Enter") addWaiter();
              }}
              className="bg-[#F7F8F4] border border-[#002D09]/15 rounded-lg px-3 py-2 text-sm outline-none"
            />
          </label>
          <button
            type="button"
            onClick={addWaiter}
            disabled={adding || uploading || !newName.trim()}
            className="px-5 py-2 rounded-full bg-[#002D09] text-white text-sm font-semibold disabled:opacity-50"
          >
            {uploading ? w.uploading : w.add}
          </button>
        </div>
      </DashboardCard>

      <DashboardCard>
        <h2 className="font-semibold text-[#343233]">{w.resultsTitle}</h2>
        {waiters.every((x) => x.count === 0) ? (
          <p className="text-sm text-[#343233]/60 mt-3">{w.resultsEmpty}</p>
        ) : (
          <ul className="mt-4 grid sm:grid-cols-2 gap-3">
            {waiters
              .filter((x) => x.count > 0)
              .map((x) => (
                <li key={x.id} className="rounded-xl border border-black/[0.06] p-4 flex items-center gap-3">
                  <Avatar name={x.name} url={x.photoUrl} />
                  <div className="min-w-0">
                    <p className="font-medium text-[#343233] truncate">{x.name}</p>
                    <p className="text-sm flex items-center gap-1 text-[#343233]">
                      <Star size={13} className="fill-amber-400 text-amber-400" aria-hidden />
                      <span className="font-semibold">{x.avg!.toFixed(1)}</span>
                      <span className="text-[#343233]/50">· {w.reviewsCount(x.count)}</span>
                    </p>
                    {x.count30 > 0 && (
                      <p className="text-xs text-[#343233]/50">
                        {w.last30}: {x.avg30!.toFixed(1)} ({x.count30})
                      </p>
                    )}
                  </div>
                </li>
              ))}
          </ul>
        )}

        {recentReviews.length > 0 && (
          <>
            <h3 className="font-semibold text-[#343233] mt-7">{w.recentTitle}</h3>
            <ul className="mt-3 divide-y divide-black/[0.06]">
              {recentReviews.map((r) => (
                <li key={r.id} className="py-3 flex items-start gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-[#343233]">
                      <span className="font-medium">{r.waiterName}</span>
                      <span className="mx-1.5 text-[#343233]/30">·</span>
                      <span className="inline-flex items-center gap-1">
                        <Star size={12} className="fill-amber-400 text-amber-400" aria-hidden />
                        {r.rating.toFixed(1)}
                      </span>
                      <span className="mx-1.5 text-[#343233]/30">·</span>
                      <span className="text-xs text-[#343233]/50">{dateFmt.format(new Date(r.createdAt))}</span>
                    </p>
                    <p className={`text-sm mt-0.5 break-words ${r.note ? "text-[#343233]/80" : "text-[#343233]/35"}`}>
                      {r.note ?? w.noNote}
                    </p>
                  </div>
                  <button type="button" onClick={() => deleteReview(r.id)} aria-label={w.deleteReview} className="p-1.5 rounded-md text-red-600 hover:bg-red-50 shrink-0">
                    <Trash2 size={15} aria-hidden />
                  </button>
                </li>
              ))}
            </ul>
          </>
        )}
      </DashboardCard>
    </div>
  );
}
