"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { authTranslations, getStoredLang, type Lang } from "@/lib/i18n-auth";

const GREEN = "#002D09";
const LIME = "#E7FF00";

const inputStyle: React.CSSProperties = {
  padding: "10px 12px",
  borderRadius: 10,
  border: "1px solid #ddd",
  fontSize: 14,
};

function ResetPasswordInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token");

  const [lang, setLang] = useState<Lang>("en");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setLang(getStoredLang());
  }, []);

  const t = authTranslations[lang].resetPassword;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (password !== confirmPassword) {
      setError(t.passwordMismatch);
      return;
    }
    if (!token) {
      setError(t.invalidToken);
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });

      if (!res.ok) {
        let message = t.invalidToken;
        try {
          const body = await res.json();
          if (typeof body.error === "string") message = body.error;
        } catch {}
        setError(message);
        setLoading(false);
        return;
      }

      router.push("/dashboard");
      router.refresh();
    } catch {
      setError(t.invalidToken);
      setLoading(false);
    }
  }

  if (!token) {
    return (
      <div style={{ maxWidth: 340, margin: "5rem auto", padding: "0 1rem" }} className="w-full">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo.svg" alt="Zertoo" style={{ height: 36, margin: "0 auto 32px", display: "block" }} />
        <p style={{ fontSize: 14, color: "#c0392b", textAlign: "center" }}>{t.invalidToken}</p>
        <p style={{ fontSize: 13, color: "#666", marginTop: 16, textAlign: "center" }}>
          <a href="/forgot-password" style={{ textDecoration: "underline", color: GREEN, fontWeight: 600 }}>
            {t.requestNew}
          </a>
        </p>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 340, margin: "5rem auto", padding: "0 1rem" }} className="w-full">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/logo.svg" alt="Zertoo" style={{ height: 36, margin: "0 auto 32px", display: "block" }} />
      <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 20, color: GREEN }}>{t.title}</h1>

      <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <input
          type="password"
          placeholder={t.password}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          minLength={8}
          style={inputStyle}
        />
        <input
          type="password"
          placeholder={t.confirmPassword}
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          required
          minLength={8}
          style={inputStyle}
        />
        {error && <p style={{ color: "#c0392b", fontSize: 13 }}>{error}</p>}
        <button
          type="submit"
          disabled={loading}
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
          {loading ? t.submitting : t.submit}
        </button>
      </form>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <div className="flex min-h-screen flex-col">
      <div className="flex-1 flex flex-col">
        <Suspense fallback={null}>
          <ResetPasswordInner />
        </Suspense>
      </div>

      <footer className="flex flex-col items-center gap-2 border-t border-black/[0.06] py-8">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo.svg" alt="Zertoo" className="h-4 w-auto opacity-60" />
        <p className="text-xs text-[#343233]/50">© {new Date().getFullYear()} Zertoo. Un producto de Certucce Digital LLC.</p>
      </footer>
    </div>
  );
}
