"use client";

import { useEffect, useState } from "react";
import { getStoredLang, setStoredLang, type Lang } from "@/lib/i18n-auth";

const SUPPORT_EMAIL = "hello@zertoo.app";

const CONTENT: Record<
  Lang,
  {
    title: string;
    intro: string;
    howToTitle: string;
    howToBody: string;
    fields: string[];
    responseTitle: string;
    responseBody: string;
    moreTitle: string;
    moreBody: React.ReactNode;
  }
> = {
  es: {
    title: "Soporte",
    intro:
      "¿Tenés un problema con la app Zertoo Eats o con el panel de tu negocio en Zertoo? Escribinos y te ayudamos.",
    howToTitle: "Cómo contactarnos",
    howToBody: `Escribinos a ${SUPPORT_EMAIL} contándonos:`,
    fields: [
      "Qué estabas tratando de hacer y qué pasó en cambio.",
      "Si usás la app: el modelo de tu teléfono y sistema operativo (iOS o Android).",
      "Una captura de pantalla, si es posible — ayuda mucho a entender el problema.",
    ],
    responseTitle: "Tiempo de respuesta",
    responseBody: "Respondemos todos los correos dentro de 1 a 2 días hábiles.",
    moreTitle: "Más información",
    moreBody: (
      <>
        Para preguntas sobre privacidad o para pedir la eliminación de tus datos, mirá nuestra{" "}
        <a href="/privacidad" className="text-forest underline">
          Política de Privacidad
        </a>{" "}
        o la página de{" "}
        <a href="/eliminar-datos" className="text-forest underline">
          Eliminación de datos
        </a>
        .
      </>
    ),
  },
  en: {
    title: "Support",
    intro: "Having an issue with the Zertoo Eats app or your business dashboard on Zertoo? Reach out and we'll help.",
    howToTitle: "How to contact us",
    howToBody: `Email us at ${SUPPORT_EMAIL} and let us know:`,
    fields: [
      "What you were trying to do and what happened instead.",
      "If you're using the app: your phone model and OS (iOS or Android).",
      "A screenshot, if possible — it helps a lot in understanding the issue.",
    ],
    responseTitle: "Response time",
    responseBody: "We reply to every email within 1–2 business days.",
    moreTitle: "More information",
    moreBody: (
      <>
        For privacy questions or to request deletion of your data, see our{" "}
        <a href="/privacidad" className="text-forest underline">
          Privacy Policy
        </a>{" "}
        or the{" "}
        <a href="/eliminar-datos" className="text-forest underline">
          Data Deletion
        </a>{" "}
        page.
      </>
    ),
  },
};

export default function SupportPage() {
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
        <h1 className="text-3xl font-bold text-forest mb-8">{t.title}</h1>

        <div className="space-y-4 text-graphite/90 leading-relaxed mb-10">
          <p>{t.intro}</p>
        </div>

        <section className="mb-10">
          <h2 className="text-xl font-bold text-forest mb-3">{t.howToTitle}</h2>
          <p className="text-graphite/90 leading-relaxed mb-3">{t.howToBody}</p>
          <ul className="list-disc pl-6 space-y-1 text-graphite/90">
            {t.fields.map((field) => (
              <li key={field}>{field}</li>
            ))}
          </ul>
          <p className="mt-4">
            <a href={`mailto:${SUPPORT_EMAIL}`} className="text-forest underline font-semibold">
              {SUPPORT_EMAIL}
            </a>
          </p>
        </section>

        <section className="mb-10">
          <h2 className="text-xl font-bold text-forest mb-3">{t.responseTitle}</h2>
          <p className="text-graphite/90 leading-relaxed">{t.responseBody}</p>
        </section>

        <section>
          <h2 className="text-xl font-bold text-forest mb-3">{t.moreTitle}</h2>
          <p className="text-graphite/90 leading-relaxed">{t.moreBody}</p>
        </section>
      </main>
    </div>
  );
}
