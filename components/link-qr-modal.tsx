"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { X, Download } from "lucide-react";
import { useDashboardLang } from "@/lib/dashboard-lang-context";

// Se genera en el navegador (canvas offscreen) — el link ya es público y
// conocido del lado del cliente, así que no hace falta ida y vuelta al
// server como sí la necesita el QR de 2FA (ese sí depende de un secreto
// que se genera en el server).
export default function LinkQrModal({ url, onClose }: { url: string; onClose: () => void }) {
  const { t } = useDashboardLang();
  const [dataUrl, setDataUrl] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    QRCode.toDataURL(url, { width: 320, margin: 1 }).then((result) => {
      if (!cancelled) setDataUrl(result);
    });
    return () => {
      cancelled = true;
    };
  }, [url]);

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 px-4">
      <div className="bg-white border border-[#002D09]/10 rounded-xl w-full max-w-sm p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold">{t.qrCode.title}</h2>
          <button onClick={onClose} aria-label={t.common.close} className="text-[#343233]/60 hover:text-[#002D09]">
            <X size={18} aria-hidden />
          </button>
        </div>

        <div className="flex flex-col items-center gap-4">
          <div className="w-56 h-56 flex items-center justify-center bg-[#F7F8F4] rounded-lg">
            {dataUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={dataUrl} alt={t.qrCode.title} className="w-full h-full" />
            ) : (
              <div className="w-8 h-8 border-2 border-[#002D09]/20 border-t-[#002D09] rounded-full animate-spin" />
            )}
          </div>

          <p className="text-xs text-[#343233]/70 text-center break-all">{url}</p>
          <p className="text-xs text-[#343233]/60 text-center">{t.qrCode.hint}</p>

          {dataUrl && (
            <a
              href={dataUrl}
              download="qr.png"
              className="flex items-center gap-1.5 text-sm font-medium bg-[#E7FF00] text-[#002D09] px-3.5 h-9 rounded-lg hover:brightness-105"
            >
              <Download size={16} aria-hidden />
              {t.qrCode.download}
            </a>
          )}
        </div>
      </div>
    </div>
  );
}
