"use client";

import { Suspense, useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { authTranslations, getStoredLang, translateApiError, type Lang } from "@/lib/i18n-auth";

const GREEN = "#002D09";
const LIME = "#E7FF00";
const GREEN_TINT = "#eaf2e6";

type BusinessType = "RESTAURANT" | "SMALL_BUSINESS" | "SMARTLINK";

function isBusinessType(v: string | null): v is BusinessType {
  return v === "RESTAURANT" || v === "SMALL_BUSINESS" || v === "SMARTLINK";
}

export default function SignupPage() {
  return (
    <Suspense fallback={null}>
      <SignupForm />
    </Suspense>
  );
}

function SignupForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const preselected = searchParams.get("type");

  const [lang, setLang] = useState<Lang>("en");
  // El idioma se decide por lo que la persona eligió en la landing —
  // no hay selector acá, solo lo heredamos.
  useEffect(() => {
    setLang(getStoredLang());
  }, []);

  const [businessType, setBusinessType] = useState<BusinessType>(
    isBusinessType(preselected) ? preselected : "RESTAURANT"
  );
  const [form, setForm] = useState({ businessName: "", name: "", email: "", password: "" });
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const t = authTranslations[lang].signup;
  const errors = authTranslations[lang].errors;
  const businessTypeOptions: { value: BusinessType; label: string }[] = [
    { value: "RESTAURANT", label: t.businessTypes.RESTAURANT },
    { value: "SMALL_BUSINESS", label: t.businessTypes.SMALL_BUSINESS },
    { value: "SMARTLINK", label: t.businessTypes.SMARTLINK },
  ];

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, businessType }),
      });

      if (!res.ok) {
        let message = errors.generic;
        try {
          const body = await res.json();
          if (typeof body.error === "string") message = translateApiError(body.error, lang);
        } catch {
          // La respuesta no era JSON (ej. una página de error genérica
          // de la plataforma de hosting) — nos quedamos con el mensaje
          // por defecto en vez de fallar en silencio.
        }
        setError(message);
        setLoading(false);
        return;
      }

      router.push("/verify-email");
      router.refresh();
    } catch (err) {
      // Fallo de red (sin conexión, CORS, servidor caído, etc.)
      setError(errors.networkError);
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen flex-col">
      <div style={{ maxWidth: 380, margin: "4rem auto", padding: "0 1rem" }} className="w-full flex-1">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/logo.svg"
          alt="Zertoo"
          style={{ height: 36, margin: "0 auto 32px", display: "block" }}
        />

        <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 4, color: GREEN }}>{t.title}</h1>
        <p style={{ color: "#666", marginBottom: 24, fontSize: 14 }}>{t.subtitle}</p>

        <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
          {businessTypeOptions.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => setBusinessType(opt.value)}
              style={{
                flex: 1,
                padding: "10px 6px",
                borderRadius: 10,
                fontSize: 12,
                fontWeight: 600,
                border: businessType === opt.value ? `1.5px solid ${GREEN}` : "1px solid #ddd",
                background: businessType === opt.value ? GREEN_TINT : "white",
                color: GREEN,
              }}
            >
              {opt.label}
            </button>
          ))}
        </div>

        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <input
            placeholder={t.businessName}
            value={form.businessName}
            onChange={(e) => setForm({ ...form, businessName: e.target.value })}
            required
            style={inputStyle}
          />
          <input
            placeholder={t.yourName}
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            required
            style={inputStyle}
          />
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

        <p style={{ fontSize: 13, color: "#666", marginTop: 16, textAlign: "center" }}>
          {t.haveAccount}{" "}
          <a href="/login" style={{ textDecoration: "underline", color: GREEN, fontWeight: 600 }}>
            {t.loginLink}
          </a>
        </p>
      </div>

      <footer className="flex flex-col items-center gap-2 border-t border-black/[0.06] py-8">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo.svg" alt="Zertoo" className="h-4 w-auto opacity-60" />
        <p className="text-xs text-[#343233]/50">© {new Date().getFullYear()} Zertoo</p>
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
