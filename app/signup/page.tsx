"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function SignupPage() {
  const router = useRouter();
  const [businessType, setBusinessType] = useState<"RESTAURANT" | "SMALL_BUSINESS">("RESTAURANT");
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

      router.push("/dashboard/menu");
      router.refresh();
    } catch (err) {
      // Fallo de red (sin conexión, CORS, servidor caído, etc.)
      setError("No se pudo conectar con el servidor. Intenta de nuevo.");
      setLoading(false);
    }
  }

  return (
    <div style={{ maxWidth: 380, margin: "4rem auto", padding: "0 1rem" }}>
      <h1 style={{ fontSize: 22, fontWeight: 600, marginBottom: 4 }}>Crea tu cuenta</h1>
      <p style={{ color: "#666", marginBottom: 24, fontSize: 14 }}>14 días gratis, sin tarjeta</p>

      <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
        {(
          [
            { value: "RESTAURANT", label: "Restaurante" },
            { value: "SMALL_BUSINESS", label: "Negocio de servicios" },
          ] as const
        ).map((opt) => (
          <button
            key={opt.value}
            type="button"
            onClick={() => setBusinessType(opt.value)}
            style={{
              flex: 1,
              padding: "10px 8px",
              borderRadius: 8,
              fontSize: 13,
              border: businessType === opt.value ? "1.5px solid #333" : "1px solid #ddd",
              background: businessType === opt.value ? "#f5f5f5" : "white",
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
          style={{ padding: "10px 0", borderRadius: 8, background: "#1a1a1a", color: "white", fontWeight: 500, marginTop: 6 }}
        >
          {loading ? "Creando cuenta..." : "Crear cuenta"}
        </button>
      </form>

      <p style={{ fontSize: 13, color: "#666", marginTop: 16, textAlign: "center" }}>
        ¿Ya tienes cuenta? <a href="/login" style={{ textDecoration: "underline" }}>Inicia sesión</a>
      </p>
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  padding: "10px 12px",
  borderRadius: 8,
  border: "1px solid #ddd",
  fontSize: 14,
};
