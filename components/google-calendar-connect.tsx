"use client";

import { useEffect, useState } from "react";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import { Calendar, Check, X } from "lucide-react";

export default function GoogleCalendarConnect() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const [configured, setConfigured] = useState<boolean | null>(null);
  const [connected, setConnected] = useState(false);
  const [email, setEmail] = useState<string | null>(null);
  const [disconnecting, setDisconnecting] = useState(false);
  const [banner, setBanner] = useState<"connected" | "error" | "not_configured" | null>(null);

  useEffect(() => {
    const google = searchParams.get("google");
    if (google === "connected" || google === "error" || google === "not_configured") {
      setBanner(google);
      // Limpia el query param de la URL para que no quede pegado si
      // recargan la página o comparten el link.
      router.replace(pathname);
    }
  }, [searchParams, router, pathname]);

  useEffect(() => {
    fetch("/api/integrations/google-calendar/status")
      .then((r) => r.json())
      .then((data) => {
        setConfigured(data.configured);
        setConnected(data.connected);
        setEmail(data.email);
      })
      .catch(() => setConfigured(false));
  }, [banner]);

  async function handleDisconnect() {
    setDisconnecting(true);
    await fetch("/api/integrations/google-calendar/disconnect", { method: "POST" });
    setConnected(false);
    setEmail(null);
    setDisconnecting(false);
  }

  if (configured === null) return null;

  return (
    <div className="border border-[#002D09]/10 rounded-lg p-4">
      {banner === "connected" && (
        <p className="text-sm text-green-700 bg-green-50 rounded-md px-3 py-2 mb-3">
          Google Calendar conectado correctamente.
        </p>
      )}
      {banner === "error" && (
        <p className="text-sm text-red-700 bg-red-50 rounded-md px-3 py-2 mb-3">
          No se pudo conectar con Google. Intenta de nuevo.
        </p>
      )}
      {banner === "not_configured" && (
        <p className="text-sm text-amber-700 bg-amber-50 rounded-md px-3 py-2 mb-3">
          Esta plataforma todavía no tiene la integración de Google configurada. Avísale a tu
          administrador.
        </p>
      )}

      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-lg bg-[#F7F8F4] flex items-center justify-center shrink-0">
          <Calendar size={16} className="text-[#002D09]" aria-hidden />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold">Google Calendar</p>
          {connected ? (
            <p className="text-xs text-[#343233]/60 flex items-center gap-1">
              <Check size={12} className="text-green-600" aria-hidden />
              Conectado{email ? ` como ${email}` : ""}
            </p>
          ) : (
            <p className="text-xs text-[#343233]/60">
              Cada cita confirmada se agrega automáticamente a tu calendario.
            </p>
          )}
        </div>
        {connected ? (
          <button
            onClick={handleDisconnect}
            disabled={disconnecting}
            className="flex items-center gap-1 text-xs px-3 py-2 rounded-lg border border-[#002D09]/15 hover:bg-[#F7F8F4] shrink-0"
          >
            <X size={12} aria-hidden />
            Desconectar
          </button>
        ) : (
          <a
            href="/api/integrations/google-calendar/connect"
            className="text-xs px-3 py-2 rounded-lg bg-[#E7FF00] text-[#002D09] font-medium hover:brightness-105 shrink-0"
          >
            Conectar
          </a>
        )}
      </div>
    </div>
  );
}
