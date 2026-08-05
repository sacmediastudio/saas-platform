"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();
  const [form, setForm] = useState({ email: "", password: "" });
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

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
        let message = `Error del servidor (${res.status})`;
        try {
          const body = await res.json();
          if (typeof body.error === "string") message = body.error;
        } catch {
          // Respuesta no-JSON — nos quedamos con el mensaje por defecto.
        }
        setError(message);
        setLoading(false);
        return;
      }

      router.push("/dashboard/menu");
      router.refresh();
    } catch (err) {
      setError("No se pudo conectar con el servidor. Intenta de nuevo.");
      setLoading(false);
    }
  }

  return (
    <div style={{ maxWidth: 340, margin: "5rem auto", padding: "0 1rem" }}>
      <h1 style={{ fontSize: 22, fontWeight: 600, marginBottom: 20 }}>Inicia sesión</h1>

      <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 10 }}>
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
          placeholder="Contraseña"
          value={form.password}
          onChange={(e) => setForm({ ...form, password: e.target.value })}
          required
          style={inputStyle}
        />
        {error && <p style={{ color: "#c0392b", fontSize: 13 }}>{error}</p>}
        <button
          type="submit"
          disabled={loading}
          style={{ padding: "10px 0", borderRadius: 8, background: "#1a1a1a", color: "white", fontWeight: 500, marginTop: 6 }}
        >
          {loading ? "Entrando..." : "Entrar"}
        </button>
      </form>

      <p style={{ fontSize: 13, color: "#666", marginTop: 16, textAlign: "center" }}>
        ¿No tienes cuenta? <a href="/signup" style={{ textDecoration: "underline" }}>Regístrate</a>
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
