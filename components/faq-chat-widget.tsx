"use client";

import { useEffect, useState } from "react";
import { MessageCircleQuestion, X, ChevronLeft } from "lucide-react";

interface Faq {
  id: string;
  question: string;
  answer: string;
}

export default function FaqChatWidget({
  tenantSlug,
  buttonColor,
  buttonTextColor,
  themeBgColor,
  themeTextColor,
}: {
  tenantSlug: string;
  buttonColor: string;
  buttonTextColor: string;
  themeBgColor: string;
  themeTextColor: string;
}) {
  const [faqs, setFaqs] = useState<Faq[] | null>(null);
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<Faq | null>(null);

  useEffect(() => {
    fetch(`/api/public/faqs?slug=${tenantSlug}`)
      .then((r) => r.json())
      .then((data) => setFaqs(data.faqs ?? []))
      .catch(() => setFaqs([]));
  }, [tenantSlug]);

  // Sin preguntas cargadas todavía, o el negocio no configuró ninguna
  // — no mostramos nada (nunca un botón flotante que abra a un chat vacío).
  if (!faqs || faqs.length === 0) return null;

  return (
    <>
      <button
        onClick={() => {
          setOpen((v) => !v);
          setSelected(null);
        }}
        aria-label={open ? "Cerrar preguntas frecuentes" : "Preguntas frecuentes"}
        className="fixed bottom-5 left-5 z-40 flex items-center justify-center w-12 h-12 rounded-full shadow-lg hover:brightness-105 transition-all"
        style={{ backgroundColor: buttonColor, color: buttonTextColor }}
      >
        {open ? <X size={20} aria-hidden /> : <MessageCircleQuestion size={20} aria-hidden />}
      </button>

      {open && (
        <div
          className="fixed bottom-20 left-5 z-40 w-[calc(100vw-2.5rem)] max-w-xs rounded-2xl shadow-xl overflow-hidden border"
          style={{
            backgroundColor: themeBgColor,
            color: themeTextColor,
            borderColor: "color-mix(in srgb, currentColor 12%, transparent)",
          }}
        >
          <div
            className="px-4 py-3 border-b"
            style={{ borderColor: "color-mix(in srgb, currentColor 10%, transparent)" }}
          >
            <p className="text-sm font-semibold flex items-center gap-1.5">
              <MessageCircleQuestion size={15} aria-hidden />
              Preguntas frecuentes
            </p>
          </div>

          <div className="max-h-80 overflow-y-auto">
            {selected ? (
              <div className="p-4">
                <button
                  onClick={() => setSelected(null)}
                  className="flex items-center gap-1 text-xs opacity-60 hover:opacity-100 mb-3"
                >
                  <ChevronLeft size={12} aria-hidden />
                  Volver
                </button>
                <p className="text-sm font-semibold mb-1.5">{selected.question}</p>
                <p className="text-sm opacity-80 leading-relaxed">{selected.answer}</p>
              </div>
            ) : (
              <div
                className="flex flex-col divide-y"
                style={{ borderColor: "color-mix(in srgb, currentColor 8%, transparent)" }}
              >
                {faqs.map((faq) => (
                  <button
                    key={faq.id}
                    onClick={() => setSelected(faq)}
                    className="w-full text-left px-4 py-3 text-sm hover:brightness-95 transition-all"
                  >
                    {faq.question}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
