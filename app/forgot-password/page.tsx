"use client";

import { useState, useEffect } from "react";
import { authTranslations, getStoredLang, type Lang } from "@/lib/i18n-auth";

const GREEN = "#002D09";
const LIME = "#E7FF00";

export default function ForgotPasswordPage() {
  const [lang, setLang] = useState<Lang>("en");
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "done">("idle");

  useEffect(() => {
    setLang(getStoredLang());
  }, []);

  const t = authTranslations[lang].forgotPassword;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("sending");
    try {
      await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
    } catch {
      // Da igual si falla la red — mostramos el mismo mensaje siempre,
      // mismo criterio de no filtrar información que ya usa el endpoint.
    }
    setStatus("done");
  }

  return (
    <div className="flex min-h-screen flex-col">
      <div style={{ maxWidth: 340, margin: "5rem auto", padding: "0 1rem" }} className="w-full flex-1">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo.svg" alt="Zertoo" style={{ height: 36, margin: "0 auto 32px", display: "block" }} />

        <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 8, color: GREEN }}>{t.title}</h1>

        {status === "done" ? (
          <>
            <p style={{ fontSize: 14, color: "#343233", marginTop: 16 }}>{t.done}</p>
            <p style={{ fontSize: 13, color: "#666", marginTop: 20, textAlign: "center" }}>
              <a href="/login" style={{ textDecoration: "underline", color: GREEN, fontWeight: 600 }}>
                {t.backToLogin}
              </a>
            </p>
          </>
        ) : (
          <>
            <p style={{ fontSize: 14, color: "#666", marginBottom: 20 }}>{t.subtitle}</p>
            <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <input
                type="email"
                placeholder={t.email}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                style={inputStyle}
              />
              <button
                type="submit"
                disabled={status === "sending"}
                style={{
                  padding: "11px 0",
                  borderRadius: 999,
                  background: LIME,
                  color: GREEN,
                  fontWeight: 700,
                  fontSize: 14,
                  marginTop: 6,
                }}
              >
                {status === "sending" ? t.submitting : t.submit}
              </button>
            </form>
            <p style={{ fontSize: 13, color: "#666", marginTop: 16, textAlign: "center" }}>
              <a href="/login" style={{ textDecoration: "underline", color: GREEN, fontWeight: 600 }}>
                {t.backToLogin}
              </a>
            </p>
          </>
        )}
      </div>

      <footer className="flex flex-col items-center gap-2 border-t border-black/[0.06] py-8">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo.svg" alt="Zertoo" className="h-4 w-auto opacity-60" />
        <p className="text-xs text-[#343233]/50">© {new Date().getFullYear()} Zertoo. Un producto de Certucce Digital LLC.</p>
      </footer>
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  padding: "10px 12px",
  borderRadius: 10,
  border: "1px solid #ddd",
  fontSize: 14,
};
