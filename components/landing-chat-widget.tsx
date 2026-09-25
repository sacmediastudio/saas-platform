"use client";

import { useEffect, useRef, useState } from "react";
import { MessageCircle, X, Send } from "lucide-react";
import type { Lang } from "@/lib/i18n-landing";

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

const COPY: Record<Lang, { greeting: string; placeholder: string; title: string; genericError: string }> = {
  es: {
    greeting: "¡Hola! Soy el asistente de Zertoo. ¿En qué te puedo ayudar? Puedo contarte sobre precios, productos y cómo empezar.",
    placeholder: "Escribe tu pregunta...",
    title: "Zertoo",
    genericError: "No se pudo conectar con el asistente. Escríbenos a hello@zertoo.app.",
  },
  en: {
    greeting: "Hi! I'm Zertoo's assistant. How can I help? Ask me about pricing, products, or how to get started.",
    placeholder: "Type your question...",
    title: "Zertoo",
    genericError: "Couldn't connect to the assistant. Email us at hello@zertoo.app.",
  },
};

// Solo la landing corporativa (zertoo.app) — nada que ver con el
// FaqChatWidget por-tenant que ya existe en las páginas públicas de
// cada negocio (ese es una lista estática, sin IA detrás).
export default function LandingChatWidget({ lang }: { lang: Lang }) {
  const c = COPY[lang];
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([{ role: "assistant", content: c.greeting }]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, open]);

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    const text = input.trim();
    if (!text || sending) return;

    const next = [...messages, { role: "user" as const, content: text }];
    setMessages(next);
    setInput("");
    setSending(true);

    try {
      const res = await fetch("/api/public/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        // Solo mandamos los últimos turnos — no hace falta el historial
        // completo para que el bot conteste bien, y mantiene el costo
        // por mensaje acotado.
        body: JSON.stringify({ messages: next.slice(-10), lang }),
      });
      const body = await res.json().catch(() => ({}));

      if (!res.ok || typeof body.reply !== "string") {
        setMessages((prev) => [...prev, { role: "assistant", content: body.error || c.genericError }]);
        return;
      }

      setMessages((prev) => [...prev, { role: "assistant", content: body.reply }]);
    } catch {
      setMessages((prev) => [...prev, { role: "assistant", content: c.genericError }]);
    } finally {
      setSending(false);
    }
  }

  return (
    <>
      <button
        onClick={() => setOpen((v) => !v)}
        aria-label={open ? "Cerrar chat" : "Abrir chat"}
        className="fixed bottom-5 right-5 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-forest text-white shadow-[0_12px_30px_-10px_rgba(0,45,9,0.55)] transition-transform hover:scale-105"
      >
        {open ? <X size={22} aria-hidden /> : <MessageCircle size={22} aria-hidden />}
      </button>

      {open && (
        <div className="fixed bottom-24 right-5 z-40 flex h-[520px] max-h-[70vh] w-[calc(100vw-2.5rem)] max-w-sm flex-col overflow-hidden rounded-[20px] border border-forest/10 bg-white shadow-[0_24px_70px_-30px_rgba(0,45,9,0.45)]">
          <div className="flex items-center gap-2.5 bg-forest px-5 py-4 text-white shrink-0">
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-lime text-forest font-extrabold text-sm">
              Z
            </span>
            <span className="font-bold">{c.title}</span>
          </div>

          <div ref={listRef} className="flex-1 overflow-y-auto px-4 py-4 flex flex-col gap-3">
            {messages.map((m, i) => (
              <div
                key={i}
                className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-[14px] leading-relaxed ${
                  m.role === "user" ? "self-end bg-forest text-white" : "self-start bg-[#F7F8F4] text-graphite"
                }`}
              >
                {m.content}
              </div>
            ))}
            {sending && (
              <div className="self-start rounded-2xl bg-[#F7F8F4] px-4 py-2.5 text-[14px] text-graphite/50">···</div>
            )}
          </div>

          <form onSubmit={handleSend} className="flex items-center gap-2 border-t border-forest/[0.08] p-3 shrink-0">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={c.placeholder}
              maxLength={2000}
              className="flex-1 rounded-full border border-forest/15 bg-[#F7F8F4] px-4 py-2.5 text-sm outline-none focus:border-forest/40"
            />
            <button
              type="submit"
              disabled={sending || !input.trim()}
              aria-label="Enviar"
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-lime text-forest disabled:opacity-40"
            >
              <Send size={16} aria-hidden />
            </button>
          </form>
        </div>
      )}
    </>
  );
}
