"use client";

import { useEffect, useState } from "react";

// Países más usados en la isla — Aruba primero y seleccionado por
// defecto. Estados Unidos y Canadá comparten +1, por eso el selector
// guarda el código ISO y no solo el prefijo.
const COUNTRIES = [
  { iso: "AW", dial: "297" },
  { iso: "CO", dial: "57" },
  { iso: "US", dial: "1" },
  { iso: "CW", dial: "599" },
  { iso: "NL", dial: "31" },
  { iso: "AR", dial: "54" },
  { iso: "VE", dial: "58" },
  { iso: "EC", dial: "593" },
  { iso: "BR", dial: "55" },
  { iso: "CA", dial: "1" },
] as const;

type Props = {
  /** Número completo con código de país ("+2975551234"), o "" si está vacío. */
  value: string;
  onChange: (fullNumber: string) => void;
  lang: "es" | "en";
  required?: boolean;
  className?: string;
};

/**
 * Campo de WhatsApp con selector de código de país a la izquierda. Hacia
 * afuera sigue siendo un solo string con el número completo, igual que
 * el input de texto que reemplaza, así que el resto del formulario y el
 * servidor no cambian. Si la persona escribe o pega un número que ya
 * empieza con "+", se respeta tal cual y se ignora el selector.
 */
export default function PhoneField({ value, onChange, lang, required, className = "" }: Props) {
  const [iso, setIso] = useState<string>("AW");
  const [national, setNational] = useState("");

  // Si el formulario se limpia desde afuera (por ejemplo tras enviar),
  // vaciar también lo que se ve.
  useEffect(() => {
    if (value === "" && national !== "") setNational("");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  function compose(nextIso: string, nextNational: string): string {
    const trimmed = nextNational.trim();
    if (!trimmed) return "";
    if (trimmed.startsWith("+")) return `+${trimmed.replace(/\D/g, "")}`;
    const digits = trimmed.replace(/\D/g, "").replace(/^0+/, "");
    if (!digits) return "";
    const dial = COUNTRIES.find((c) => c.iso === nextIso)?.dial ?? "297";
    return `+${dial}${digits}`;
  }

  return (
    <div className={`flex gap-2 ${className}`}>
      <select
        value={iso}
        onChange={(e) => {
          setIso(e.target.value);
          onChange(compose(e.target.value, national));
        }}
        aria-label={lang === "en" ? "Country code" : "Código de país"}
        className="w-[7rem] shrink-0 px-2 py-2.5 rounded-lg border border-neutral-200 text-base bg-white"
      >
        {COUNTRIES.map((c) => (
          <option key={c.iso} value={c.iso}>
            {c.iso} +{c.dial}
          </option>
        ))}
      </select>
      <input
        type="tel"
        inputMode="tel"
        autoComplete="tel-national"
        value={national}
        onChange={(e) => {
          setNational(e.target.value);
          onChange(compose(iso, e.target.value));
        }}
        required={required}
        placeholder={lang === "en" ? "Your WhatsApp number" : "Tu número de WhatsApp"}
        className="min-w-0 flex-1 px-3 py-2.5 rounded-lg border border-neutral-200 text-base"
      />
    </div>
  );
}
