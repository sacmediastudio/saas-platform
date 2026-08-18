"use client";

import { useState } from "react";
import { Shield, ShieldOff } from "lucide-react";
import DashboardCard from "@/components/dashboard-card";

export default function SecurityView({ initialEnabled }: { initialEnabled: boolean }) {
  const [enabled, setEnabled] = useState(initialEnabled);
  const [setupStep, setSetupStep] = useState<"idle" | "scanning" | "disabling">("idle");
  const [secret, setSecret] = useState("");
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState("");
  const [token, setToken] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function startSetup() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/2fa/setup/start", { method: "POST" });
      const body = await res.json();
      setSecret(body.secret);
      setQrCodeDataUrl(body.qrCodeDataUrl);
      setSetupStep("scanning");
    } catch {
      setError("No se pudo conectar con el servidor.");
    }
    setLoading(false);
  }

  async function confirmSetup(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/2fa/setup/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ secret, token }),
      });
      const body = await res.json();
      if (!res.ok) {
        setError(body.error ?? "Código incorrecto");
        setLoading(false);
        return;
      }
      setEnabled(true);
      setSetupStep("idle");
      setToken("");
    } catch {
      setError("No se pudo conectar con el servidor.");
    }
    setLoading(false);
  }

  async function confirmDisable(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/2fa/disable", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });
      const body = await res.json();
      if (!res.ok) {
        setError(body.error ?? "Código incorrecto");
        setLoading(false);
        return;
      }
      setEnabled(false);
      setSetupStep("idle");
      setToken("");
    } catch {
      setError("No se pudo conectar con el servidor.");
    }
    setLoading(false);
  }

  return (
    <div className="flex flex-col gap-5">
      <DashboardCard>
        <h1 className="text-xl font-semibold mb-1 flex items-center gap-2">
          <Shield size={20} aria-hidden />
          Seguridad
        </h1>
        <p className="text-sm text-[#343233]/70 mb-6">
          Verificación en dos pasos para este panel — puede ver clientes de todos los negocios y
          mandar campañas masivas, vale la pena la protección extra.
        </p>

        {setupStep === "idle" && (
          <>
            <div className="flex items-center gap-3 mb-4">
              <span
                className={`text-xs px-2.5 py-1 rounded-md font-medium ${enabled ? "bg-green-50 text-green-700" : "bg-[#F7F8F4] text-[#343233]"}`}
              >
                {enabled ? "Activada" : "Desactivada"}
              </span>
            </div>

            {enabled ? (
              <button
                onClick={() => setSetupStep("disabling")}
                className="flex items-center gap-1.5 text-sm font-medium px-4 h-9 rounded-lg border border-red-200 text-red-700 hover:bg-red-50"
              >
                <ShieldOff size={15} aria-hidden />
                Desactivar
              </button>
            ) : (
              <button
                onClick={startSetup}
                disabled={loading}
                className="text-sm font-semibold px-4 h-9 rounded-lg bg-[#E7FF00] text-[#002D09] hover:brightness-105 disabled:opacity-50"
              >
                {loading ? "Generando..." : "Activar verificación en dos pasos"}
              </button>
            )}
          </>
        )}

        {setupStep === "scanning" && (
          <form onSubmit={confirmSetup} className="flex flex-col gap-4 max-w-xs">
            <p className="text-sm text-[#343233]/70">
              Escanea este código con Google Authenticator, Authy, 1Password, o cualquier app de
              autenticación:
            </p>
            {qrCodeDataUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={qrCodeDataUrl} alt="Código QR para configurar 2FA" className="w-48 h-48 self-center" />
            )}
            <p className="text-xs text-[#343233]/60">
              ¿No puedes escanear? Escribe este código manualmente en tu app:
            </p>
            <p className="text-xs font-mono bg-[#F7F8F4] rounded-lg px-3 py-2 break-all">{secret}</p>

            <label className="flex flex-col gap-1">
              <span className="text-xs text-[#343233]/70">Código de 6 dígitos de tu app</span>
              <input
                type="text"
                inputMode="numeric"
                value={token}
                onChange={(e) => setToken(e.target.value.replace(/\D/g, "").slice(0, 6))}
                maxLength={6}
                required
                className="bg-[#F7F8F4] border border-[#002D09]/15 rounded-lg px-3 py-2 text-sm outline-none text-center tracking-widest"
              />
            </label>

            {error && <p className="text-red-600 text-sm">{error}</p>}

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => {
                  setSetupStep("idle");
                  setToken("");
                  setError(null);
                }}
                className="flex-1 py-2 rounded-lg border border-[#002D09]/15 text-sm hover:bg-[#F7F8F4]"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={loading || token.length !== 6}
                className="flex-1 py-2 rounded-lg bg-[#E7FF00] text-[#002D09] text-sm font-medium hover:brightness-105 disabled:opacity-50"
              >
                {loading ? "Verificando..." : "Confirmar"}
              </button>
            </div>
          </form>
        )}

        {setupStep === "disabling" && (
          <form onSubmit={confirmDisable} className="flex flex-col gap-4 max-w-xs">
            <p className="text-sm text-[#343233]/70">
              Para desactivar, escribe el código de 6 dígitos actual de tu app de autenticación.
            </p>
            <input
              type="text"
              inputMode="numeric"
              value={token}
              onChange={(e) => setToken(e.target.value.replace(/\D/g, "").slice(0, 6))}
              maxLength={6}
              required
              className="bg-[#F7F8F4] border border-[#002D09]/15 rounded-lg px-3 py-2 text-sm outline-none text-center tracking-widest"
            />
            {error && <p className="text-red-600 text-sm">{error}</p>}
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => {
                  setSetupStep("idle");
                  setToken("");
                  setError(null);
                }}
                className="flex-1 py-2 rounded-lg border border-[#002D09]/15 text-sm hover:bg-[#F7F8F4]"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={loading || token.length !== 6}
                className="flex-1 py-2 rounded-lg border border-red-200 text-red-700 text-sm font-medium hover:bg-red-50 disabled:opacity-50"
              >
                {loading ? "Verificando..." : "Desactivar"}
              </button>
            </div>
          </form>
        )}
      </DashboardCard>
    </div>
  );
}
