"use client";

import { useRef, useState } from "react";
import { Clapperboard, Plus, Trash2, Heart, X } from "lucide-react";
import DashboardCard from "@/components/dashboard-card";
import { useDashboardLang } from "@/lib/dashboard-lang-context";
import {
  REEL_ALLOWED_EXTENSIONS,
  REEL_ALLOWED_TYPES,
  REEL_CAPTION_MAX,
  REEL_DURATION_TOLERANCE_SEC,
  REEL_MAX_DURATION_SEC,
  REEL_MAX_PER_TENANT,
  REEL_MAX_SIZE_BYTES,
} from "@/lib/reels";

interface ReelItem {
  id: string;
  videoUrl: string;
  posterUrl: string;
  durationSec: number;
  caption: string | null;
  likesCount: number;
}

interface VideoInfo {
  duration: number;
  width: number;
  height: number;
  poster: Blob;
}

// Lee duración, tamaño en pantalla y un fotograma (portada) del video
// directo en el navegador, sin subirlo todavía.
function inspectVideo(file: File): Promise<VideoInfo> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const video = document.createElement("video");
    video.preload = "metadata";
    video.muted = true;
    video.playsInline = true;
    const cleanup = () => URL.revokeObjectURL(url);
    video.onerror = () => {
      cleanup();
      reject(new Error("unreadable"));
    };
    video.onloadedmetadata = () => {
      video.currentTime = Math.min(0.5, (video.duration || 1) / 2);
    };
    video.onseeked = () => {
      try {
        const scale = Math.min(1, 540 / video.videoWidth);
        const canvas = document.createElement("canvas");
        canvas.width = Math.round(video.videoWidth * scale);
        canvas.height = Math.round(video.videoHeight * scale);
        canvas.getContext("2d")!.drawImage(video, 0, 0, canvas.width, canvas.height);
        const info = { duration: video.duration, width: video.videoWidth, height: video.videoHeight };
        canvas.toBlob(
          (blob) => {
            cleanup();
            blob ? resolve({ ...info, poster: blob }) : reject(new Error("unreadable"));
          },
          "image/jpeg",
          0.82
        );
      } catch {
        cleanup();
        reject(new Error("unreadable"));
      }
    };
    video.src = url;
  });
}

// PUT con progreso (fetch no reporta progreso de subida).
function putWithProgress(url: string, body: Blob, contentType: string, onProgress: (pct: number) => void): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", url);
    xhr.setRequestHeader("Content-Type", contentType);
    xhr.upload.onprogress = (e) => e.lengthComputable && onProgress(Math.round((e.loaded / e.total) * 100));
    xhr.onload = () => (xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new Error("put")));
    xhr.onerror = () => reject(new Error("put"));
    xhr.send(body);
  });
}

async function presign(path: string, payload: object): Promise<{ uploadUrl: string; publicUrl: string }> {
  const res = await fetch(path, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(typeof body.error === "string" ? body.error : "presign");
  return body;
}

export default function ReelsView({ initialReels }: { initialReels: ReelItem[] }) {
  const { t } = useDashboardLang();
  const [reels, setReels] = useState(initialReels);
  const [open, setOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [info, setInfo] = useState<VideoInfo | null>(null);
  const [posterPreview, setPosterPreview] = useState<string | null>(null);
  const [caption, setCaption] = useState("");
  const [phase, setPhase] = useState<"idle" | "checking" | "uploading">("idle");
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const full = reels.length >= REEL_MAX_PER_TENANT;

  function reset() {
    if (posterPreview) URL.revokeObjectURL(posterPreview);
    setPosterPreview(null);
    setOpen(false);
    setFile(null);
    setInfo(null);
    setCaption("");
    setPhase("idle");
    setProgress(0);
    setError(null);
    if (inputRef.current) inputRef.current.value = "";
  }

  async function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const picked = e.target.files?.[0];
    setError(null);
    setInfo(null);
    setFile(null);
    if (posterPreview) URL.revokeObjectURL(posterPreview);
    setPosterPreview(null);
    if (!picked) return;

    const ext = picked.name.slice(picked.name.lastIndexOf(".")).toLowerCase();
    const typeOk =
      (REEL_ALLOWED_TYPES as readonly string[]).includes(picked.type) ||
      (picked.type === "" && (REEL_ALLOWED_EXTENSIONS as readonly string[]).includes(ext));
    if (!typeOk) return setError(t.reels.errors.type);
    if (picked.size > REEL_MAX_SIZE_BYTES) return setError(t.reels.errors.size);

    setPhase("checking");
    try {
      const v = await inspectVideo(picked);
      if (v.duration > REEL_MAX_DURATION_SEC + REEL_DURATION_TOLERANCE_SEC) return setError(t.reels.errors.duration);
      if (v.height < v.width) return setError(t.reels.errors.orientation);
      setFile(picked);
      setInfo(v);
      setPosterPreview(URL.createObjectURL(v.poster));
    } catch {
      setError(t.reels.errors.unreadable);
    } finally {
      setPhase("idle");
    }
  }

  async function submit() {
    if (!file || !info) return;
    setPhase("uploading");
    setProgress(0);
    setError(null);
    try {
      const videoType = file.type || "video/mp4";
      const video = await presign("/api/tenant/reels/presign", { fileName: file.name, fileType: videoType, fileSize: file.size });
      await putWithProgress(video.uploadUrl, file, videoType, setProgress);

      const poster = await presign("/api/uploads/presign", { fileName: "poster.jpg", fileType: "image/jpeg" });
      await putWithProgress(poster.uploadUrl, info.poster, "image/jpeg", () => {});

      const res = await fetch("/api/tenant/reels", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          videoUrl: video.publicUrl,
          posterUrl: poster.publicUrl,
          durationSec: info.duration,
          width: info.width,
          height: info.height,
          caption: caption.trim() || undefined,
        }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(typeof body.error === "string" ? body.error : "create");
      setReels((list) => [body.reel, ...list]);
      reset();
    } catch (err) {
      setError(err instanceof Error && err.message.length > 12 ? err.message : t.reels.errors.generic);
      setPhase("idle");
    }
  }

  async function remove(reel: ReelItem) {
    if (!confirm(t.reels.confirmDelete)) return;
    setBusyId(reel.id);
    const res = await fetch(`/api/tenant/reels/${reel.id}`, { method: "DELETE" });
    if (res.ok) setReels((list) => list.filter((r) => r.id !== reel.id));
    setBusyId(null);
  }

  return (
    <div>
      <DashboardCard>
        <div className="flex flex-wrap items-start justify-between gap-3 mb-1">
          <div>
            <h1 className="text-xl font-semibold flex items-center gap-2">
              <Clapperboard size={20} aria-hidden />
              {t.reels.title}
            </h1>
            <p className="text-sm text-[#343233]/70 mt-1">{t.reels.subtitle}</p>
          </div>
          <button
            onClick={() => setOpen(true)}
            disabled={full}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold bg-[#E7FF00] text-[#002D09] disabled:opacity-40"
          >
            <Plus size={16} aria-hidden />
            {t.reels.add}
          </button>
        </div>
        <p className="text-xs font-semibold text-[#343233]/60 mt-3">
          {t.reels.slotsUsed(reels.length, REEL_MAX_PER_TENANT)}
          {full && <span className="font-normal"> — {t.reels.limitReached}</span>}
        </p>

        <div className="mt-4 rounded-xl bg-[#F7F8F4] p-4">
          <p className="text-xs font-bold uppercase tracking-wide text-[#343233]/60 mb-2">{t.reels.specsTitle}</p>
          <ul className="list-disc pl-5 text-sm text-[#343233]/80 space-y-1">
            {t.reels.specs.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </div>
      </DashboardCard>

      <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-4">
        {reels.length === 0 && <p className="text-sm text-[#343233]/60 sm:col-span-3">{t.reels.empty}</p>}
        {reels.map((reel) => (
          <DashboardCard key={reel.id}>
            <div className="relative aspect-[9/16] w-full overflow-hidden rounded-xl bg-black">
              <video
                src={reel.videoUrl}
                poster={reel.posterUrl}
                controls
                playsInline
                preload="none"
                className="absolute inset-0 h-full w-full object-cover"
              />
            </div>
            <div className="mt-3 flex items-start justify-between gap-2">
              <div className="min-w-0">
                {reel.caption && <p className="text-sm font-medium truncate">{reel.caption}</p>}
                <p className="text-xs text-[#343233]/60 flex items-center gap-2 mt-0.5">
                  <span>{t.reels.seconds(reel.durationSec)}</span>
                  <span className="flex items-center gap-1">
                    <Heart size={12} aria-hidden /> {t.reels.likes(reel.likesCount)}
                  </span>
                </p>
              </div>
              <button
                onClick={() => remove(reel)}
                disabled={busyId === reel.id}
                aria-label={t.reels.deleteLabel}
                className="shrink-0 p-2 rounded-lg text-red-600 hover:bg-red-50 disabled:opacity-40"
              >
                <Trash2 size={16} aria-hidden />
              </button>
            </div>
          </DashboardCard>
        ))}
      </div>

      {open && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={phase === "uploading" ? undefined : reset}>
          <div className="bg-white rounded-2xl p-6 w-full max-w-md max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">{t.reels.add}</h2>
              <button onClick={reset} disabled={phase === "uploading"} aria-label={t.reels.cancel} className="p-1 disabled:opacity-40">
                <X size={18} aria-hidden />
              </button>
            </div>

            <input
              ref={inputRef}
              type="file"
              accept="video/mp4,video/quicktime,.mp4,.mov"
              onChange={onPick}
              disabled={phase !== "idle"}
              className="block w-full text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-[#E7FF00] file:px-4 file:py-2 file:text-sm file:font-semibold file:text-[#002D09]"
            />
            {phase === "checking" && <p className="mt-3 text-sm text-[#343233]/70">{t.reels.processing}</p>}

            {info && file && (
              <div className="mt-4 flex gap-4">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={posterPreview ?? ""} alt="" className="w-24 aspect-[9/16] rounded-lg object-cover bg-black" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-[#343233]/60 truncate">{file.name}</p>
                  <p className="text-xs text-[#343233]/60 mt-1">
                    {t.reels.seconds(info.duration)} · {info.width}×{info.height} · {(file.size / 1024 / 1024).toFixed(1)} MB
                  </p>
                  <label className="block text-xs font-semibold mt-3 mb-1">{t.reels.captionLabel}</label>
                  <input
                    value={caption}
                    onChange={(e) => setCaption(e.target.value.slice(0, REEL_CAPTION_MAX))}
                    placeholder={t.reels.captionPlaceholder}
                    className="w-full px-3 py-2 rounded-lg border border-[#343233]/15 text-base"
                  />
                </div>
              </div>
            )}

            {phase === "uploading" && (
              <div className="mt-4">
                <div className="h-2 rounded bg-[#F7F8F4] overflow-hidden">
                  <div className="h-2 bg-[#E7FF00]" style={{ width: `${progress}%` }} />
                </div>
                <p className="mt-1 text-xs text-[#343233]/60">
                  {t.reels.uploading} {progress}%
                </p>
              </div>
            )}

            {error && <p className="mt-3 text-sm text-red-600">{error}</p>}

            <div className="mt-5 flex gap-2">
              <button
                onClick={reset}
                disabled={phase === "uploading"}
                className="flex-1 py-2.5 rounded-lg border border-[#343233]/15 text-sm disabled:opacity-40"
              >
                {t.reels.cancel}
              </button>
              <button
                onClick={submit}
                disabled={!info || phase !== "idle"}
                className="flex-1 py-2.5 rounded-lg text-sm font-semibold bg-[#E7FF00] text-[#002D09] disabled:opacity-40"
              >
                {t.reels.upload}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
