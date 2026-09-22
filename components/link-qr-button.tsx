"use client";

import { useState } from "react";
import { QrCode } from "lucide-react";
import { useDashboardLang } from "@/lib/dashboard-lang-context";
import LinkQrModal from "./link-qr-modal";

// Botón chico para meter al lado del botón de "copiar" en cualquier fila
// de link público (smartlink, bookings, etc.) — cada uno maneja su propio
// estado de apertura, así el padre no necesita cablear nada extra.
export default function LinkQrButton({ url }: { url: string }) {
  const { t } = useDashboardLang();
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        aria-label={t.qrCode.buttonLabel}
        title={t.qrCode.buttonLabel}
        className="text-[#343233]/70 hover:text-[#002D09] shrink-0"
      >
        <QrCode size={15} aria-hidden />
      </button>
      {open && <LinkQrModal url={url} onClose={() => setOpen(false)} />}
    </>
  );
}
