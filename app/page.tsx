export default function HomePage() {
  return (
    <div style={{ maxWidth: 480, margin: "6rem auto", textAlign: "center", padding: "0 1rem" }}>
      <h1 style={{ fontSize: 26, fontWeight: 600, marginBottom: 10 }}>
        Menú digital, reservas y reseñas
      </h1>
      <p style={{ color: "#666", marginBottom: 28 }}>
        Todo lo que tu restaurante o negocio necesita, en un solo lugar.
      </p>
      <div style={{ display: "flex", gap: 10, justifyContent: "center" }}>
        <a
          href="/signup"
          style={{ padding: "10px 20px", borderRadius: 8, background: "#1a1a1a", color: "white", fontSize: 14 }}
        >
          Crear cuenta gratis
        </a>
        <a
          href="/login"
          style={{ padding: "10px 20px", borderRadius: 8, border: "1px solid #ddd", fontSize: 14 }}
        >
          Iniciar sesión
        </a>
      </div>
    </div>
  );
}
