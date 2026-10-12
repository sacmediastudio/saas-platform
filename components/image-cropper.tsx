"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { X } from "lucide-react";

export const CROP_ASPECT = 4 / 3;
const OUTPUT_MAX_WIDTH = 1200;
const MAX_ZOOM = 3;

export interface CropperLabels {
  title: string;
  hint: string;
  zoom: string;
  cancel: string;
  apply: string;
  applying: string;
  error: string;
}

/** Relación de aspecto (ancho/alto) real de un archivo de imagen, respetando la orientación EXIF. */
export function readImageSize(file: File): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new window.Image();
    img.onload = () => {
      resolve({ width: img.naturalWidth, height: img.naturalHeight });
      URL.revokeObjectURL(url);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("No se pudo leer la imagen"));
    };
    img.src = url;
  });
}

/** ¿Ya viene en 4:3 (con un 2 % de tolerancia)? Entonces no hace falta recortar. */
export function isCropAspect(size: { width: number; height: number }): boolean {
  return Math.abs(size.width / size.height / CROP_ASPECT - 1) <= 0.02;
}

// Editor de recorte con proporción fija 4:3: se arrastra la foto para
// encuadrarla y se acerca con el control, la rueda del mouse o pellizcando.
// Al aplicar entrega un JPEG ya recortado (máx. 1200 px de ancho).
export default function ImageCropper({
  file,
  labels,
  onCancel,
  onConfirm,
}: {
  file: File;
  labels: CropperLabels;
  onCancel: () => void;
  onConfirm: (blob: Blob) => void | Promise<void>;
}) {
  const frameRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const [src, setSrc] = useState<string | null>(null);
  const [natural, setNatural] = useState<{ w: number; h: number } | null>(null);
  const [frame, setFrame] = useState<{ w: number; h: number }>({ w: 0, h: 0 });
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const pinchStart = useRef<{ dist: number; zoom: number } | null>(null);

  useEffect(() => {
    const url = URL.createObjectURL(file);
    setSrc(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  // Tamaño del marco (ancho disponible, alto = ancho * 3/4).
  useEffect(() => {
    const el = frameRef.current;
    if (!el) return;
    const measure = () => setFrame({ w: el.clientWidth, h: Math.round(el.clientWidth / CROP_ASPECT) });
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const baseScale = natural && frame.w ? Math.max(frame.w / natural.w, frame.h / natural.h) : 1;
  const scale = baseScale * zoom;

  const clamp = useCallback(
    (x: number, y: number, s: number) => {
      if (!natural) return { x, y };
      const minX = Math.min(0, frame.w - natural.w * s);
      const minY = Math.min(0, frame.h - natural.h * s);
      return { x: Math.min(0, Math.max(minX, x)), y: Math.min(0, Math.max(minY, y)) };
    },
    [natural, frame]
  );

  // Centra la foto cuando se conocen las medidas.
  useEffect(() => {
    if (!natural || !frame.w) return;
    const s = Math.max(frame.w / natural.w, frame.h / natural.h) * zoom;
    setOffset((o) => {
      const first = o.x === 0 && o.y === 0;
      return clamp(first ? (frame.w - natural.w * s) / 2 : o.x, first ? (frame.h - natural.h * s) / 2 : o.y, s);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [natural, frame.w, frame.h]);

  // Cambia el zoom manteniendo fijo el punto (fx, fy) del marco.
  function applyZoom(nextZoom: number, fx = frame.w / 2, fy = frame.h / 2) {
    const z = Math.min(MAX_ZOOM, Math.max(1, nextZoom));
    if (!natural) return;
    const oldS = baseScale * zoom;
    const newS = baseScale * z;
    const imgX = (fx - offset.x) / oldS;
    const imgY = (fy - offset.y) / oldS;
    setZoom(z);
    setOffset(clamp(fx - imgX * newS, fy - imgY * newS, newS));
  }

  function onPointerDown(e: React.PointerEvent) {
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()];
      pinchStart.current = { dist: Math.hypot(a.x - b.x, a.y - b.y), zoom };
    }
  }
  function onPointerMove(e: React.PointerEvent) {
    const prev = pointers.current.get(e.pointerId);
    if (!prev) return;
    const cur = { x: e.clientX, y: e.clientY };
    pointers.current.set(e.pointerId, cur);
    if (pointers.current.size === 2 && pinchStart.current) {
      const [a, b] = [...pointers.current.values()];
      const dist = Math.hypot(a.x - b.x, a.y - b.y);
      applyZoom(pinchStart.current.zoom * (dist / pinchStart.current.dist));
    } else if (pointers.current.size === 1) {
      setOffset((o) => clamp(o.x + (cur.x - prev.x), o.y + (cur.y - prev.y), scale));
    }
  }
  function onPointerUp(e: React.PointerEvent) {
    pointers.current.delete(e.pointerId);
    if (pointers.current.size < 2) pinchStart.current = null;
  }
  function onWheel(e: React.WheelEvent) {
    const rect = e.currentTarget.getBoundingClientRect();
    applyZoom(zoom * (e.deltaY < 0 ? 1.08 : 1 / 1.08), e.clientX - rect.left, e.clientY - rect.top);
  }

  async function apply() {
    const img = imgRef.current;
    if (!img || !natural || busy) return;
    setBusy(true);
    setError(null);
    try {
      const sx = -offset.x / scale;
      const sy = -offset.y / scale;
      const sw = frame.w / scale;
      const sh = frame.h / scale;
      // Ancho múltiplo de 4 para que el alto sea un entero exacto (4:3 sin redondeos).
      const outW = Math.max(4, Math.floor(Math.min(OUTPUT_MAX_WIDTH, sw) / 4) * 4);
      const outH = (outW / 4) * 3;
      const canvas = document.createElement("canvas");
      canvas.width = outW;
      canvas.height = outH;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("canvas");
      ctx.imageSmoothingQuality = "high";
      ctx.drawImage(img, sx, sy, sw, sh, 0, 0, outW, outH);
      const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.85));
      if (!blob) throw new Error("blob");
      await onConfirm(blob);
    } catch {
      setError(labels.error);
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/70 px-4">
      <div className="max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-xl bg-white p-5">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-base font-semibold">{labels.title}</h2>
          <button onClick={onCancel} disabled={busy} aria-label={labels.cancel} className="text-[#343233]/60 hover:text-[#002D09] disabled:opacity-40">
            <X size={18} aria-hidden />
          </button>
        </div>
        <p className="mb-3 text-xs text-[#343233]/70">{labels.hint}</p>

        <div
          ref={frameRef}
          className="relative w-full touch-none select-none overflow-hidden rounded-lg bg-black"
          style={{ aspectRatio: "4 / 3", cursor: "grab" }}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          onWheel={onWheel}
        >
          {src && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              ref={imgRef}
              src={src}
              alt=""
              draggable={false}
              onLoad={(e) => setNatural({ w: e.currentTarget.naturalWidth, h: e.currentTarget.naturalHeight })}
              className="pointer-events-none absolute left-0 top-0 max-w-none"
              style={
                natural
                  ? { width: natural.w * scale, height: natural.h * scale, transform: `translate(${offset.x}px, ${offset.y}px)` }
                  : { visibility: "hidden" }
              }
            />
          )}
          {/* Guías de tercios para encuadrar */}
          <div className="pointer-events-none absolute inset-0 border border-white/60">
            <div className="absolute inset-y-0 left-1/3 w-px bg-white/30" />
            <div className="absolute inset-y-0 left-2/3 w-px bg-white/30" />
            <div className="absolute inset-x-0 top-1/3 h-px bg-white/30" />
            <div className="absolute inset-x-0 top-2/3 h-px bg-white/30" />
          </div>
        </div>

        <label className="mt-4 flex items-center gap-3 text-xs font-medium text-[#343233]/70">
          {labels.zoom}
          <input
            type="range"
            min={1}
            max={MAX_ZOOM}
            step={0.01}
            value={zoom}
            onChange={(e) => applyZoom(Number(e.target.value))}
            className="flex-1 accent-[#002D09]"
          />
        </label>

        {error && <p className="mt-3 text-sm text-red-600">{error}</p>}

        <div className="mt-5 flex gap-2">
          <button
            type="button"
            onClick={onCancel}
            disabled={busy}
            className="flex-1 rounded-lg border border-[#343233]/15 py-2.5 text-sm disabled:opacity-40"
          >
            {labels.cancel}
          </button>
          <button
            type="button"
            onClick={apply}
            disabled={busy || !natural}
            className="flex-1 rounded-lg bg-[#E7FF00] py-2.5 text-sm font-semibold text-[#002D09] disabled:opacity-40"
          >
            {busy ? labels.applying : labels.apply}
          </button>
        </div>
      </div>
    </div>
  );
}
