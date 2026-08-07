"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { authTranslations, getStoredLang, translateApiError, type Lang } from "@/lib/i18n-auth";

const GREEN = "#002D09";
const LIME = "#E7FF00";

export default function LoginPage() {
  const router = useRouter();
  const [lang, setLang] = useState<Lang>("en");
  const [form, setForm] = useState({ email: "", password: "" });
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // El idioma se decide por lo que la persona eligió en la landing —
  // no hay selector acá, solo lo heredamos.
  useEffect(() => {
    setLang(getStoredLang());
  }, []);

  const t = authTranslations[lang].login;
  const errors = authTranslations[lang].errors;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });

      if (!res.ok) {
        let message = errors.generic;
        try {
          const body = await res.json();
          if (typeof body.error === "string") message = translateApiError(body.error, lang);
        } catch {
          // Respuesta no-JSON — nos quedamos con el mensaje por defecto.
        }
        setError(message);
        setLoading(false);
        return;
      }

      router.push("/dashboard");
      router.refresh();
    } catch (err) {
      setError(errors.networkError);
      setLoading(false);
    }
  }

  return (
    <div style={{ maxWidth: 340, margin: "5rem auto", padding: "0 1rem" }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/logo.svg"
        alt="Zertoo"
        style={{ height: 36, margin: "0 auto 32px", display: "block" }}
      />

      <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 20, color: GREEN }}>{t.title}</h1>

      <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <input
          type="email"
          placeholder={t.email}
          value={form.email}
          onChange={(e) => setForm({ ...form, email: e.target.value })}
          required
          style={inputStyle}
        />
        <input
          type="password"
          placeholder={t.password}
          value={form.password}
          onChange={(e) => setForm({ ...form, password: e.target.value })}
          required
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

      <p style={{ fontSize: 13, color: "#666", marginTop: 16, textAlign: "center" }}>
        {t.noAccount}{" "}
        <a href="/signup" style={{ textDecoration: "underline", color: GREEN, fontWeight: 600 }}>
          {t.signUpLink}
        </a>
      </p>
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  padding: "10px 12px",
  borderRadius: 10,
  border: "1px solid #ddd",
  fontSize: 14,
};
