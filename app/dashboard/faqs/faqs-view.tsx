"use client";

import { useState } from "react";
import { Plus, Pencil, Trash2, X, ArrowUp, ArrowDown, MessageCircleQuestion } from "lucide-react";

interface Faq {
  id: string;
  question: string;
  answer: string;
  sortOrder: number;
}

export default function FaqsView({ initialFaqs }: { initialFaqs: Faq[] }) {
  const [faqs, setFaqs] = useState(initialFaqs);
  const [modal, setModal] = useState<{ mode: "create" | "edit"; faq?: Faq } | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const sorted = [...faqs].sort((a, b) => a.sortOrder - b.sortOrder);

  async function move(faq: Faq, direction: -1 | 1) {
    const idx = sorted.findIndex((f) => f.id === faq.id);
    const swapWith = sorted[idx + direction];
    if (!swapWith) return;

    setBusy(faq.id);
    const prev = faqs;
    setFaqs((list) =>
      list.map((f) => {
        if (f.id === faq.id) return { ...f, sortOrder: swapWith.sortOrder };
        if (f.id === swapWith.id) return { ...f, sortOrder: faq.sortOrder };
        return f;
      })
    );

    const [res1, res2] = await Promise.all([
      fetch(`/api/faqs/${faq.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sortOrder: swapWith.sortOrder }),
      }),
      fetch(`/api/faqs/${swapWith.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sortOrder: faq.sortOrder }),
      }),
    ]);
    if (!res1.ok || !res2.ok) setFaqs(prev);
    setBusy(null);
  }

  async function deleteFaq(faq: Faq) {
    if (!confirm(`¿Borrar la pregunta "${faq.question}"?`)) return;
    setBusy(faq.id);
    const res = await fetch(`/api/faqs/${faq.id}`, { method: "DELETE" });
    if (res.ok) setFaqs((list) => list.filter((f) => f.id !== faq.id));
    setBusy(null);
  }

  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-3 mb-1">
        <div>
          <h1 className="text-xl font-semibold flex items-center gap-2">
            <MessageCircleQuestion size={20} aria-hidden />
            Preguntas frecuentes
          </h1>
          <p className="text-sm text-[#343233]/70 mt-1">
            Aparecen como un chat en tu página pública, para resolver dudas comunes sin que tengan que
            escribirte a ti directamente.
          </p>
        </div>
        <button
          onClick={() => setModal({ mode: "create" })}
          className="flex items-center gap-1.5 text-sm font-medium bg-[#E7FF00] text-[#002D09] px-3.5 h-9 rounded-lg hover:brightness-105"
        >
          <Plus size={16} aria-hidden />
          Agregar pregunta
        </button>
      </div>

      {sorted.length === 0 && (
        <p className="text-sm text-[#343233]/60 mt-6">Todavía no tienes ninguna pregunta. Agrega la primera.</p>
      )}

      <div className="flex flex-col gap-2 mt-6">
        {sorted.map((faq, idx) => (
          <div key={faq.id} className="border border-[#002D09]/10 rounded-lg px-4 py-3">
            <div className="flex items-start gap-3">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold">{faq.question}</p>
                <p className="text-sm text-[#343233]/70 mt-1">{faq.answer}</p>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <button
                  onClick={() => move(faq, -1)}
                  disabled={idx === 0 || busy === faq.id}
                  aria-label="Mover arriba"
                  className="text-[#343233]/60 hover:text-[#002D09] disabled:opacity-30"
                >
                  <ArrowUp size={14} aria-hidden />
                </button>
                <button
                  onClick={() => move(faq, 1)}
                  disabled={idx === sorted.length - 1 || busy === faq.id}
                  aria-label="Mover abajo"
                  className="text-[#343233]/60 hover:text-[#002D09] disabled:opacity-30"
                >
                  <ArrowDown size={14} aria-hidden />
                </button>
                <button
                  onClick={() => setModal({ mode: "edit", faq })}
                  aria-label="Editar"
                  className="text-[#343233]/60 hover:text-[#002D09] ml-1"
                >
                  <Pencil size={14} aria-hidden />
                </button>
                <button
                  onClick={() => deleteFaq(faq)}
                  disabled={busy === faq.id}
                  aria-label="Borrar"
                  className="text-[#343233]/60 hover:text-red-600"
                >
                  <Trash2 size={14} aria-hidden />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {modal && (
        <FaqModal
          mode={modal.mode}
          faq={modal.faq}
          onClose={() => setModal(null)}
          onCreated={(f) => setFaqs((prev) => [...prev, f])}
          onUpdated={(f) => setFaqs((prev) => prev.map((x) => (x.id === f.id ? f : x)))}
        />
      )}
    </div>
  );
}

function FaqModal({
  mode,
  faq,
  onClose,
  onCreated,
  onUpdated,
}: {
  mode: "create" | "edit";
  faq?: Faq;
  onClose: () => void;
  onCreated: (f: Faq) => void;
  onUpdated: (f: Faq) => void;
}) {
  const [question, setQuestion] = useState(faq?.question ?? "");
  const [answer, setAnswer] = useState(faq?.answer ?? "");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);

    try {
      const path = mode === "create" ? "/api/faqs" : `/api/faqs/${faq!.id}`;
      const method = mode === "create" ? "POST" : "PATCH";
      const res = await fetch(path, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question, answer }),
      });

      if (!res.ok) {
        let message = "No se pudo guardar";
        try {
          const body = await res.json();
          if (typeof body.error === "string") message = body.error;
        } catch {}
        setError(message);
        setSaving(false);
        return;
      }

      const body = await res.json();
      const saved: Faq = body.faq;
      if (mode === "create") onCreated(saved);
      else onUpdated(saved);
      onClose();
    } catch {
      setError("No se pudo conectar con el servidor. Intenta de nuevo.");
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 px-4">
      <div className="bg-white border border-[#002D09]/10 rounded-xl w-full max-w-sm p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold">{mode === "create" ? "Agregar pregunta" : "Editar pregunta"}</h2>
          <button onClick={onClose} aria-label="Cerrar" className="text-[#343233]/60 hover:text-[#002D09]">
            <X size={18} aria-hidden />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <label className="flex flex-col gap-1">
            <span className="text-xs text-[#343233]/70">Pregunta</span>
            <input
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              required
              maxLength={200}
              placeholder="¿Tienen estacionamiento?"
              className={inputClass}
            />
          </label>

          <label className="flex flex-col gap-1">
            <span className="text-xs text-[#343233]/70">Respuesta</span>
            <textarea
              value={answer}
              onChange={(e) => setAnswer(e.target.value)}
              required
              maxLength={1000}
              rows={4}
              placeholder="Sí, tenemos estacionamiento gratuito para clientes."
              className={`${inputClass} resize-none`}
            />
          </label>

          {error && <p className="text-red-600 text-sm">{error}</p>}

          <div className="flex gap-2 mt-1">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2 rounded-lg border border-[#002D09]/15 text-sm hover:bg-[#F7F8F4]"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex-1 py-2 rounded-lg bg-[#E7FF00] text-[#002D09] text-sm font-medium hover:brightness-105 disabled:opacity-50"
            >
              {saving ? "Guardando..." : mode === "create" ? "Agregar" : "Guardar"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

const inputClass =
  "w-full bg-[#F7F8F4] border border-[#002D09]/15 rounded-lg px-3 py-2 text-sm outline-none focus:border-[#002D09]/40";
