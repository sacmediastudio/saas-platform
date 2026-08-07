"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const GREEN = "#002D09";
const LIME = "#E7FF00";

export default function AdminLoginPage() {
  const router = useRouter();
  const [form, setForm] = useState({ email: "", password: "" });
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await fetch("/api/admin/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });

      if (!res.ok) {
        let message = "No se pudo iniciar sesión";
        try {
          const body = await res.json();
          if (typeof body.error === "string") message = body.error;
        } catch {}
        setError(message);
        setLoading(false);
        return;
      }

      router.push("/admin");
      router.refresh();
    } catch {
      setError("No se pudo conectar con el servidor. Intenta de nuevo.");
      setLoading(false);
    }
  }

  return (
    <div style={{ maxWidth: 340, margin: "6rem auto", padding: "0 1rem" }}>
      <img src="/logo.svg" alt="Zertoo" style={{ height: 32, margin: "0 auto 12px", display: "block" }} />
      <p style={{ textAlign: "center", fontSize: 12, fontWeight: 700, letterSpacing: 1, color: "#343233", opacity: 0.5, marginBottom: 28 }}>
        PANEL DE ADMINISTRACIÓN
      </p>

      <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <input
          type="email"
          placeholder="admin@zertoo.com"
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
          {loading ? "Entrando..." : "Entrar"}
        </button>
      </form>
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  padding: "10px 12px",
  borderRadius: 10,
  border: "1px solid #ddd",
  fontSize: 14,
};
