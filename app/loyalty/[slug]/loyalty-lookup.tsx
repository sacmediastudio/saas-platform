"use client";

import { useState } from "react";
import { Stamp, Gift } from "lucide-react";

export default function LoyaltyLookup({ slug }: { slug: string }) {
  const [email, setEmail] = useState("");
  const [result, setResult] = useState<{
    businessName: string;
    stamps: number;
    visitsNeeded: number;
    reward: string;
  } | null>(null);
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("loading");
    try {
      const res = await fetch(`/api/public/loyalty?slug=${slug}&email=${encodeURIComponent(email)}`);
      if (!res.ok) {
        setStatus("error");
        return;
      }
      const data = await res.json();
      setResult(data);
      setStatus("idle");
    } catch {
      setStatus("error");
    }
  }

  const hasReward = result && result.stamps >= result.visitsNeeded;

  return (
    <div className="max-w-sm mx-auto min-h-screen px-6 pt-16 flex flex-col items-center">
      <Stamp size={32} className="mb-4 opacity-70" aria-hidden />
      <h1 className="text-lg font-semibold text-center mb-1">Tus sellos</h1>
      <p className="text-sm text-center opacity-60 mb-8">
        Ingresa el correo con el que reservas para ver cuántas visitas llevas.
      </p>

      <form onSubmit={handleSubmit} className="w-full flex flex-col gap-3">
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="name@correo.com"
          required
          className="w-full px-3 py-2.5 rounded-lg border border-neutral-200 text-sm"
        />
        <button
          type="submit"
          disabled={status === "loading"}
          className="w-full py-2.5 rounded-lg bg-[#E7FF00] text-[#002D09] text-sm font-semibold disabled:opacity-50"
        >
          {status === "loading" ? "Buscando..." : "Consultar"}
        </button>
      </form>

      {status === "error" && (
        <p className="text-sm text-red-600 mt-4 text-center">
          No pudimos encontrar este programa, o el negocio todavía no lo tiene activo.
        </p>
      )}

      {result && (
        <div className="w-full mt-8 border border-neutral-200 rounded-xl p-5 text-center">
          <p className="text-sm opacity-60 mb-1">{result.businessName}</p>
          <p className="text-3xl font-extrabold mb-1">
            {result.stamps} / {result.visitsNeeded}
          </p>
          <p className="text-sm opacity-60 mb-4">sellos</p>

          <div className="flex justify-center gap-1.5 flex-wrap mb-4">
            {Array.from({ length: result.visitsNeeded }).map((_, i) => (
              <span
                key={i}
                className={`w-6 h-6 rounded-full border ${
                  i < result.stamps ? "bg-[#E7FF00] border-[#E7FF00]" : "border-neutral-300"
                }`}
              />
            ))}
          </div>

          {hasReward ? (
            <div className="flex items-center justify-center gap-1.5 text-sm font-semibold bg-[#E7FF00] text-[#002D09] rounded-lg py-2.5 px-3">
              <Gift size={15} aria-hidden />
              ¡Ganaste! {result.reward}
            </div>
          ) : (
            <p className="text-xs opacity-60">
              Te faltan {result.visitsNeeded - result.stamps} visita{result.visitsNeeded - result.stamps === 1 ? "" : "s"} para: {result.reward}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
