import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Política de Privacidad | Zertoo",
  description: "Cómo Zertoo recopila, usa y protege la información de los negocios y sus clientes.",
};

const LAST_UPDATED = "16 de septiembre de 2026";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-10">
      <h2 className="text-xl font-bold text-forest mb-3">{title}</h2>
      <div className="space-y-3 text-graphite/90 leading-relaxed">{children}</div>
    </section>
  );
}

export default function PrivacyPolicyPage() {
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
        <h1 className="text-3xl font-bold text-forest mb-2">Política de Privacidad</h1>
        <p className="text-sm text-graphite/60 mb-10">Última actualización: {LAST_UPDATED}</p>

        <Section title="1. Quiénes somos">
          <p>
            Zertoo es una plataforma que ofrece herramientas digitales (menús, sistema de citas,
            programas de lealtad y enlaces de contacto) a pequeños negocios y restaurantes. Zertoo es
            un producto de Certucce Digital LLC.
          </p>
        </Section>

        <Section title="2. Qué información recopilamos">
          <p>Dependiendo de cómo uses Zertoo, podemos recopilar:</p>
          <ul className="list-disc pl-6 space-y-1">
            <li>Datos de contacto de negocios: nombre del negocio, correo, teléfono, dirección y datos de facturación.</li>
            <li>
              Datos de los clientes finales de un negocio: nombre, teléfono y correo, cuando hacen un
              pedido, reservan una cita, o se registran en un programa de lealtad a través de un negocio
              que usa Zertoo.
            </li>
            <li>Información del pedido o la reserva: qué se pidió, cuándo, y cómo se entrega.</li>
            <li>
              Identificadores técnicos básicos guardados en el dispositivo (como un identificador
              anónimo) para reconocer visitas repetidas y prevenir abuso de promociones.
            </li>
          </ul>
        </Section>

        <Section title="3. Cómo usamos esta información">
          <ul className="list-disc pl-6 space-y-1">
            <li>Para procesar y confirmar pedidos y reservas.</li>
            <li>Para enviar confirmaciones y notificaciones por correo electrónico o WhatsApp.</li>
            <li>Para operar programas de lealtad, incluyendo tarjetas digitales para Apple Wallet y Google Wallet.</li>
            <li>Para prevenir el uso indebido de promociones y recompensas.</li>
            <li>Para brindar soporte técnico a los negocios que usan la plataforma.</li>
          </ul>
        </Section>

        <Section title="4. Con quién compartimos información">
          <p>
            No vendemos información personal. Compartimos datos únicamente con proveedores que nos
            ayudan a operar el servicio, y solo en la medida necesaria para esa función:
          </p>
          <ul className="list-disc pl-6 space-y-1">
            <li>Proveedores de mensajería (como Twilio) para el envío de mensajes de WhatsApp.</li>
            <li>Proveedores de correo electrónico para el envío de confirmaciones.</li>
            <li>Apple y Google, para la emisión de tarjetas de lealtad en Apple Wallet y Google Wallet.</li>
            <li>Proveedores de infraestructura en la nube, para el alojamiento de la plataforma.</li>
          </ul>
        </Section>

        <Section title="5. Cuánto tiempo conservamos la información">
          <p>
            Conservamos la información mientras la cuenta del negocio esté activa, o mientras sea
            necesario para cumplir con obligaciones legales o resolver disputas.
          </p>
        </Section>

        <Section title="6. Tus derechos">
          <p>
            Podés solicitar acceso, corrección o eliminación de tu información escribiéndonos a{" "}
            <a href="mailto:privacidad@zertoo.app" className="text-forest underline">
              privacidad@zertoo.app
            </a>
            . Si sos cliente de un negocio que usa Zertoo, también podés dirigir tu solicitud
            directamente a ese negocio.
          </p>
        </Section>

        <Section title="7. Seguridad">
          <p>
            Usamos medidas técnicas razonables (como conexiones cifradas y acceso restringido) para
            proteger la información contra acceso no autorizado.
          </p>
        </Section>

        <Section title="8. Cambios a esta política">
          <p>
            Podemos actualizar esta política ocasionalmente. Publicaremos cualquier cambio en esta
            misma página con la fecha de actualización correspondiente.
          </p>
        </Section>

        <Section title="9. Contacto">
          <p>
            Para preguntas sobre esta política, escribinos a{" "}
            <a href="mailto:privacidad@zertoo.app" className="text-forest underline">
              privacidad@zertoo.app
            </a>
            .
          </p>
        </Section>
      </main>
    </div>
  );
}
