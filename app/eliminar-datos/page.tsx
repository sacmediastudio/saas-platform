"use client";

import { useEffect, useState } from "react";
import { getStoredLang, setStoredLang, type Lang } from "@/lib/i18n-auth";

const CONTENT: Record<
  Lang,
  {
    title: string;
    intro: string;
    howToTitle: string;
    howToBody: string;
    fields: string[];
    afterTitle: string;
    afterBody: string;
    moreTitle: string;
    moreBody: React.ReactNode;
  }
> = {
  es: {
    title: "Eliminación de datos de usuario",
    intro:
      "Si sos dueño de un negocio que usa Zertoo, o cliente de un negocio que usa Zertoo, y querés que eliminemos tu información personal de nuestros sistemas, podés solicitarlo en cualquier momento.",
    howToTitle: "Cómo solicitarlo",
    howToBody:
      "Escribinos a privacidad@zertoo.app desde el correo o número asociado a tu cuenta o pedido, indicando:",
    fields: [
      "Tu nombre completo.",
      "El correo o número de teléfono que usaste con el negocio.",
      "Si sos cliente de un negocio específico, el nombre de ese negocio (si lo recordás).",
    ],
    afterTitle: "Qué pasa después",
    afterBody:
      "Vamos a confirmar tu solicitud por el mismo medio, y eliminar tu información personal de nuestros sistemas dentro de los 30 días siguientes, salvo que debamos conservar parte de ella por una obligación legal (por ejemplo, registros de facturación).",
    moreTitle: "Más información",
    moreBody: (
      <>
        Para más detalle sobre qué información recopilamos y cómo la usamos, mirá nuestra{" "}
        <a href="/privacidad" className="text-forest underline">
          Política de Privacidad
        </a>
        .
      </>
    ),
  },
  en: {
    title: "User Data Deletion",
    intro:
      "If you own a business that uses Zertoo, or you're a customer of a business that uses Zertoo, and you'd like us to delete your personal information from our systems, you can request this at any time.",
    howToTitle: "How to request it",
    howToBody:
      "Email us at privacidad@zertoo.app from the email or phone number associated with your account or order, including:",
    fields: [
      "Your full name.",
      "The email or phone number you used with the business.",
      "If you're a customer of a specific business, that business's name (if you remember it).",
    ],
    afterTitle: "What happens next",
    afterBody:
      "We'll confirm your request through the same channel, and delete your personal information from our systems within 30 days, unless we're required to keep part of it for a legal obligation (for example, billing records).",
    moreTitle: "More information",
    moreBody: (
      <>
        For more detail on what information we collect and how we use it, see our{" "}
        <a href="/privacidad" className="text-forest underline">
          Privacy Policy
        </a>
        .
      </>
    ),
  },
};

export default function DataDeletionPage() {
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
        </section>

        <section className="mb-10">
          <h2 className="text-xl font-bold text-forest mb-3">{t.afterTitle}</h2>
          <p className="text-graphite/90 leading-relaxed">{t.afterBody}</p>
        </section>

        <section>
          <h2 className="text-xl font-bold text-forest mb-3">{t.moreTitle}</h2>
          <p className="text-graphite/90 leading-relaxed">{t.moreBody}</p>
        </section>
      </main>
    </div>
  );
}
