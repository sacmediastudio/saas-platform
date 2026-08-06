"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

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

  const [businessType, setBusinessType] = useState<BusinessType>(
    isBusinessType(preselected) ? preselected : "RESTAURANT"
  );
  const [form, setForm] = useState({ businessName: "", name: "", email: "", password: "" });
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

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
        let message = `Error del servidor (${res.status})`;
        try {
          const body = await res.json();
          if (typeof body.error === "string") message = body.error;
        } catch {
          // La respuesta no era JSON (ej. una página de error genérica
          // de la plataforma de hosting) — nos quedamos con el mensaje
          // por defecto en vez de fallar en silencio.
        }
        setError(message);
        setLoading(false);
        return;
      }

      const destination =
        businessType === "RESTAURANT"
          ? "/dashboard/menu"
          : businessType === "SMALL_BUSINESS"
          ? "/dashboard/bookings"
          : "/dashboard/smartlink";
      router.push(destination);
      router.refresh();
    } catch (err) {
      // Fallo de red (sin conexión, CORS, servidor caído, etc.)
      setError("No se pudo conectar con el servidor. Intenta de nuevo.");
      setLoading(false);
    }
  }

  return (
    <div style={{ maxWidth: 380, margin: "4rem auto", padding: "0 1rem" }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="https://horizons-cdn.hostinger.com/b813dbf4-80d8-4273-909f-1be06d6fe65f/76cf4d8e200c8f15791d1acaf0cabf5b.png"
        alt="Zertoo"
        style={{ height: 36, margin: "0 auto 32px", display: "block" }}
      />

      <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 4, color: GREEN }}>Crea tu cuenta</h1>
      <p style={{ color: "#666", marginBottom: 24, fontSize: 14 }}>14 días gratis, sin tarjeta</p>

      <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
        {(
          [
            { value: "RESTAURANT", label: "Restaurante" },
            { value: "SMALL_BUSINESS", label: "Negocio de servicios" },
            { value: "SMARTLINK", label: "Smartlink" },
          ] as const
        ).map((opt) => (
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
          placeholder="Nombre del negocio"
          value={form.businessName}
          onChange={(e) => setForm({ ...form, businessName: e.target.value })}
          required
          style={inputStyle}
        />
        <input
          placeholder="Tu nombre"
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
          required
          style={inputStyle}
        />
        <input
          type="email"
          placeholder="name@correo.com"
          value={form.email}
          onChange={(e) => setForm({ ...form, email: e.target.value })}
          required
          style={inputStyle}
        />
        <input
          type="password"
          placeholder="Contraseña (mínimo 8 caracteres)"
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
          {loading ? "Creando cuenta..." : "Crear cuenta"}
        </button>
      </form>

      <p style={{ fontSize: 13, color: "#666", marginTop: 16, textAlign: "center" }}>
        ¿Ya tienes cuenta?{" "}
        <a href="/login" style={{ textDecoration: "underline", color: GREEN, fontWeight: 600 }}>
          Inicia sesión
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
