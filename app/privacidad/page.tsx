"use client";

import { useEffect, useState } from "react";
import { getStoredLang, setStoredLang, type Lang } from "@/lib/i18n-auth";

const LAST_UPDATED: Record<Lang, string> = {
  es: "16 de septiembre de 2026",
  en: "September 16, 2026",
};

const CONTENT: Record<Lang, { title: string; sections: { heading: string; body: React.ReactNode }[] }> = {
  es: {
    title: "Política de Privacidad",
    sections: [
      {
        heading: "1. Quiénes somos",
        body: (
          <p>
            Zertoo es una plataforma que ofrece herramientas digitales (menús, sistema de citas,
            programas de lealtad y enlaces de contacto) a pequeños negocios y restaurantes. Zertoo es
            un producto de Certucce Digital LLC.
          </p>
        ),
      },
      {
        heading: "2. Qué información recopilamos",
        body: (
          <>
            <p>Dependiendo de cómo uses Zertoo, podemos recopilar:</p>
            <ul className="list-disc pl-6 space-y-1">
              <li>Datos de contacto de negocios: nombre del negocio, correo, teléfono, dirección y datos de facturación.</li>
              <li>
                Datos de los clientes finales de un negocio: nombre, teléfono y correo, cuando hacen un
                pedido, reservan una cita, o se registran en un programa de lealtad a través de un
                negocio que usa Zertoo.
              </li>
              <li>Información del pedido o la reserva: qué se pidió, cuándo, y cómo se entrega.</li>
              <li>
                Identificadores técnicos básicos guardados en el dispositivo (como un identificador
                anónimo) para reconocer visitas repetidas y prevenir abuso de promociones.
              </li>
            </ul>
          </>
        ),
      },
      {
        heading: "3. Cómo usamos esta información",
        body: (
          <ul className="list-disc pl-6 space-y-1">
            <li>Para procesar y confirmar pedidos y reservas.</li>
            <li>Para enviar confirmaciones y notificaciones por correo electrónico o WhatsApp.</li>
            <li>Para operar programas de lealtad, incluyendo tarjetas digitales para Apple Wallet y Google Wallet.</li>
            <li>Para prevenir el uso indebido de promociones y recompensas.</li>
            <li>Para brindar soporte técnico a los negocios que usan la plataforma.</li>
          </ul>
        ),
      },
      {
        heading: "4. Con quién compartimos información",
        body: (
          <>
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
          </>
        ),
      },
      {
        heading: "5. Cuánto tiempo conservamos la información",
        body: (
          <p>
            Conservamos la información mientras la cuenta del negocio esté activa, o mientras sea
            necesario para cumplir con obligaciones legales o resolver disputas.
          </p>
        ),
      },
      {
        heading: "6. Tus derechos",
        body: (
          <p>
            Podés solicitar acceso, corrección o eliminación de tu información escribiéndonos a{" "}
            <a href="mailto:privacidad@zertoo.app" className="text-forest underline">
              privacidad@zertoo.app
            </a>
            . Si sos cliente de un negocio que usa Zertoo, también podés dirigir tu solicitud
            directamente a ese negocio.
          </p>
        ),
      },
      {
        heading: "7. Seguridad",
        body: (
          <p>
            Usamos medidas técnicas razonables (como conexiones cifradas y acceso restringido) para
            proteger la información contra acceso no autorizado.
          </p>
        ),
      },
      {
        heading: "8. Cambios a esta política",
        body: (
          <p>
            Podemos actualizar esta política ocasionalmente. Publicaremos cualquier cambio en esta
            misma página con la fecha de actualización correspondiente.
          </p>
        ),
      },
      {
        heading: "9. Contacto",
        body: (
          <p>
            Para preguntas sobre esta política, escribinos a{" "}
            <a href="mailto:privacidad@zertoo.app" className="text-forest underline">
              privacidad@zertoo.app
            </a>
            .
          </p>
        ),
      },
    ],
  },
  en: {
    title: "Privacy Policy",
    sections: [
      {
        heading: "1. Who we are",
        body: (
          <p>
            Zertoo is a platform that provides digital tools (menus, a booking system, loyalty
            programs, and link pages) to small businesses and restaurants. Zertoo is a product of
            Certucce Digital LLC.
          </p>
        ),
      },
      {
        heading: "2. What information we collect",
        body: (
          <>
            <p>Depending on how you use Zertoo, we may collect:</p>
            <ul className="list-disc pl-6 space-y-1">
              <li>Business contact details: business name, email, phone, address, and billing information.</li>
              <li>
                End-customer data: name, phone, and email, when a customer places an order, books an
                appointment, or joins a loyalty program through a business that uses Zertoo.
              </li>
              <li>Order or booking details: what was ordered, when, and how it's fulfilled.</li>
              <li>
                Basic technical identifiers stored on the device (such as an anonymous ID) to
                recognize repeat visits and prevent promotion abuse.
              </li>
            </ul>
          </>
        ),
      },
      {
        heading: "3. How we use this information",
        body: (
          <ul className="list-disc pl-6 space-y-1">
            <li>To process and confirm orders and bookings.</li>
            <li>To send confirmations and notifications by email or WhatsApp.</li>
            <li>To operate loyalty programs, including digital cards for Apple Wallet and Google Wallet.</li>
            <li>To prevent misuse of promotions and rewards.</li>
            <li>To provide technical support to businesses using the platform.</li>
          </ul>
        ),
      },
      {
        heading: "4. Who we share information with",
        body: (
          <>
            <p>
              We don't sell personal information. We share data only with providers that help us
              operate the service, and only to the extent needed for that function:
            </p>
            <ul className="list-disc pl-6 space-y-1">
              <li>Messaging providers (such as Twilio) to send WhatsApp messages.</li>
              <li>Email providers to send confirmations.</li>
              <li>Apple and Google, to issue loyalty cards on Apple Wallet and Google Wallet.</li>
              <li>Cloud infrastructure providers, to host the platform.</li>
            </ul>
          </>
        ),
      },
      {
        heading: "5. How long we keep information",
        body: (
          <p>
            We keep information for as long as the business account is active, or as needed to comply
            with legal obligations or resolve disputes.
          </p>
        ),
      },
      {
        heading: "6. Your rights",
        body: (
          <p>
            You can request access to, correction of, or deletion of your information by writing to{" "}
            <a href="mailto:privacidad@zertoo.app" className="text-forest underline">
              privacidad@zertoo.app
            </a>
            . If you're a customer of a business that uses Zertoo, you can also direct your request
            straight to that business.
          </p>
        ),
      },
      {
        heading: "7. Security",
        body: (
          <p>
            We use reasonable technical measures (such as encrypted connections and restricted access)
            to protect information against unauthorized access.
          </p>
        ),
      },
      {
        heading: "8. Changes to this policy",
        body: (
          <p>
            We may update this policy from time to time. Any changes will be posted on this same page
            with the corresponding update date.
          </p>
        ),
      },
      {
        heading: "9. Contact",
        body: (
          <p>
            For questions about this policy, write to us at{" "}
            <a href="mailto:privacidad@zertoo.app" className="text-forest underline">
              privacidad@zertoo.app
            </a>
            .
          </p>
        ),
      },
    ],
  },
};

export default function PrivacyPolicyPage() {
  const [lang, setLang] = useState<Lang>("en");

  useEffect(() => {
    setLang(getStoredLang());
  }, []);

  function changeLang(next: Lang) {
    setLang(next);
    setStoredLang(next);
  }

  const t = CONTENT[lang];

  return (
    <div className="min-h-screen bg-white">
      <header className="border-b border-forest/10">
        <div className="max-w-3xl mx-auto px-6 py-6 flex items-center justify-between">
          <a href="/" className="text-lg font-bold text-forest">
            Zertoo
          </a>
          <div className="flex items-center gap-4">
            <div className="flex items-center rounded-full border border-forest/15 p-0.5 text-xs font-bold">
              {(["en", "es"] as const).map((l) => (
                <button
                  key={l}
                  type="button"
                  onClick={() => changeLang(l)}
                  className={`px-2.5 py-1 rounded-full transition-colors ${
                    lang === l ? "bg-forest text-white" : "text-forest/60"
                  }`}
                >
                  {l.toUpperCase()}
                </button>
              ))}
            </div>
            <a href="/" className="text-sm text-forest/70 hover:text-forest">
              {lang === "es" ? "Volver al inicio" : "Back home"}
            </a>
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-12">
        <h1 className="text-3xl font-bold text-forest mb-2">{t.title}</h1>
        <p className="text-sm text-graphite/60 mb-10">
          {lang === "es" ? "Última actualización" : "Last updated"}: {LAST_UPDATED[lang]}
        </p>

        {t.sections.map((section) => (
          <section key={section.heading} className="mb-10">
            <h2 className="text-xl font-bold text-forest mb-3">{section.heading}</h2>
            <div className="space-y-3 text-graphite/90 leading-relaxed">{section.body}</div>
          </section>
        ))}
      </main>
    </div>
  );
}
