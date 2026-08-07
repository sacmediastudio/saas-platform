export default function SuspendedPage() {
  return (
    <div style={{ maxWidth: 380, margin: "6rem auto", padding: "0 1rem", textAlign: "center" }}>
      <img src="/logo.svg" alt="Zertoo" style={{ height: 32, margin: "0 auto 28px", display: "block" }} />
      <h1 style={{ fontSize: 20, fontWeight: 700, marginBottom: 10, color: "#002D09" }}>
        Esta cuenta está suspendida
      </h1>
      <p style={{ color: "#666", fontSize: 14, lineHeight: 1.6 }}>
        Tu acceso al panel está temporalmente pausado. Si crees que esto es
        un error, contáctanos en{" "}
        <a href="mailto:hola@zertoo.com" style={{ color: "#002D09", fontWeight: 600 }}>
          hola@zertoo.com
        </a>
        .
      </p>
    </div>
  );
}
