import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Eliminación de Datos | Zertoo",
  description: "Cómo solicitar la eliminación de tu información en Zertoo.",
};

export default function DataDeletionPage() {
  return (
    <div className="min-h-screen bg-white">
      <header className="border-b border-forest/10">
        <div className="max-w-3xl mx-auto px-6 py-6 flex items-center justify-between">
          <a href="/" className="text-lg font-bold text-forest">
            Zertoo
          </a>
          <a href="/" className="text-sm text-forest/70 hover:text-forest">
            Volver al inicio
          </a>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-12">
        <h1 className="text-3xl font-bold text-forest mb-8">Eliminación de datos de usuario</h1>

        <div className="space-y-4 text-graphite/90 leading-relaxed mb-10">
          <p>
            Si sos dueño de un negocio que usa Zertoo, o cliente de un negocio que usa Zertoo, y
            querés que eliminemos tu información personal de nuestros sistemas, podés solicitarlo en
            cualquier momento.
          </p>
        </div>

        <section className="mb-10">
          <h2 className="text-xl font-bold text-forest mb-3">Cómo solicitarlo</h2>
          <p className="text-graphite/90 leading-relaxed mb-3">
            Escribinos a{" "}
            <a href="mailto:privacidad@zertoo.app" className="text-forest underline">
              privacidad@zertoo.app
            </a>{" "}
            desde el correo o número asociado a tu cuenta o pedido, indicando:
          </p>
          <ul className="list-disc pl-6 space-y-1 text-graphite/90">
            <li>Tu nombre completo.</li>
            <li>El correo o número de teléfono que usaste con el negocio.</li>
            <li>Si sos cliente de un negocio específico, el nombre de ese negocio (si lo recordás).</li>
          </ul>
        </section>

        <section className="mb-10">
          <h2 className="text-xl font-bold text-forest mb-3">Qué pasa después</h2>
          <p className="text-graphite/90 leading-relaxed">
            Vamos a confirmar tu solicitud por el mismo medio, y eliminar tu información personal de
            nuestros sistemas dentro de los 30 días siguientes, salvo que debamos conservar parte de
            ella por una obligación legal (por ejemplo, registros de facturación).
          </p>
        </section>

        <section>
          <h2 className="text-xl font-bold text-forest mb-3">Más información</h2>
          <p className="text-graphite/90 leading-relaxed">
            Para más detalle sobre qué información recopilamos y cómo la usamos, mirá nuestra{" "}
            <a href="/privacidad" className="text-forest underline">
              Política de Privacidad
            </a>
            .
          </p>
        </section>
      </main>
    </div>
  );
}
