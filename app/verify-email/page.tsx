"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const GREEN = "#002D09";
const LIME = "#E7FF00";

export default function VerifyEmailPage() {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [verifying, setVerifying] = useState(false);
  const [resending, setResending] = useState(false);

  async function handleVerify(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setInfo(null);
    setVerifying(true);

    try {
      const res = await fetch("/api/auth/verify-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
      });

      if (!res.ok) {
        let message = "No se pudo verificar el código";
        try {
          const body = await res.json();
          if (typeof body.error === "string") message = body.error;
        } catch {}
        setError(message);
        setVerifying(false);
        return;
      }

      router.push("/dashboard");
      router.refresh();
    } catch {
      setError("No se pudo conectar con el servidor. Intenta de nuevo.");
      setVerifying(false);
    }
  }

  async function handleResend() {
    setError(null);
    setInfo(null);
    setResending(true);
    try {
      const res = await fetch("/api/auth/resend-verification", { method: "POST" });
      if (!res.ok) {
        let message = "No se pudo reenviar el código";
        try {
          const body = await res.json();
          if (typeof body.error === "string") message = body.error;
        } catch {}
        setError(message);
        return;
      }
      setInfo("Te enviamos un nuevo código.");
    } catch {
      setError("No se pudo conectar con el servidor. Intenta de nuevo.");
    } finally {
      setResending(false);
    }
  }

  return (
    <div style={{ maxWidth: 360, margin: "5rem auto", padding: "0 1rem", textAlign: "center" }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/logo.svg" alt="Zertoo" style={{ height: 36, margin: "0 auto 32px", display: "block" }} />

      <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 8, color: GREEN }}>Verifica tu correo</h1>
      <p style={{ color: "#666", marginBottom: 28, fontSize: 14, lineHeight: 1.5 }}>
        Te enviamos un código de 6 dígitos. Ingrésalo aquí para activar tu cuenta.
      </p>

      <form onSubmit={handleVerify} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <input
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
          placeholder="000000"
          inputMode="numeric"
          maxLength={6}
          required
          style={{
            padding: "14px 12px",
            borderRadius: 10,
            border: "1px solid #ddd",
            fontSize: 24,
            letterSpacing: 8,
            textAlign: "center",
            fontWeight: 700,
            color: GREEN,
          }}
        />
        {error && <p style={{ color: "#c0392b", fontSize: 13 }}>{error}</p>}
        {info && <p style={{ color: "#1a7a3a", fontSize: 13 }}>{info}</p>}
        <button
          type="submit"
          disabled={verifying || code.length !== 6}
          style={{
            padding: "11px 0",
            borderRadius: 999,
            background: LIME,
            color: GREEN,
            fontWeight: 700,
            fontSize: 14,
            opacity: verifying || code.length !== 6 ? 0.5 : 1,
          }}
        >
          {verifying ? "Verificando..." : "Verificar"}
        </button>
      </form>

      <button
        onClick={handleResend}
        disabled={resending}
        style={{ marginTop: 20, fontSize: 13, color: GREEN, textDecoration: "underline", fontWeight: 600 }}
      >
        {resending ? "Enviando..." : "Reenviar código"}
      </button>
    </div>
  );
}
