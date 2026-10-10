"use client";

import { Check } from "lucide-react";
import Reveal from "@/components/reveal";

// Mismo "browser chrome" que usa el Hero de la home (barra con 3
// puntos + url falsa) — acá envuelve una ilustración simplificada de
// cada feature en vez de una captura real, así nunca queda desactualizado
// ni expone datos de un negocio real.
export function MockWindow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="overflow-hidden rounded-[24px] border border-forest/10 bg-white shadow-[0_24px_70px_-40px_rgba(0,45,9,0.35)]">
      <div className="flex items-center gap-1.5 border-b border-forest/[0.07] px-5 py-3.5">
        <span className="h-2.5 w-2.5 rounded-full bg-forest/10" />
        <span className="h-2.5 w-2.5 rounded-full bg-forest/10" />
        <span className="h-2.5 w-2.5 rounded-full bg-forest/10" />
        <span className="ml-3 truncate text-xs font-medium text-graphite/60">{label}</span>
      </div>
      <div className="p-6">{children}</div>
    </div>
  );
}

export function FeatureRow({
  index,
  title,
  subtitle,
  bullets,
  isNew,
  newLabel,
  Mock,
}: {
  index: number;
  title: string;
  subtitle: string;
  bullets: string[];
  isNew: boolean;
  newLabel: string;
  Mock: React.ComponentType;
}) {
  const reverse = index % 2 === 1;
  return (
    <div className="grid items-center gap-12 lg:grid-cols-2 lg:gap-16">
      <Reveal y={22} className={reverse ? "lg:order-2" : ""}>
        <div>
          {isNew && (
            <span className="mb-4 inline-flex items-center rounded-full bg-lime px-2.5 py-1 text-[11px] font-extrabold uppercase tracking-[0.1em] text-forest">
              {newLabel}
            </span>
          )}
          <h3 className="text-[clamp(1.6rem,3vw,2.25rem)] font-extrabold leading-[1.08] tracking-[-0.02em] text-forest">{title}</h3>
          <p className="mt-4 max-w-[46ch] text-[16px] leading-relaxed text-graphite">{subtitle}</p>
          <ul className="mt-7 space-y-3">
            {bullets.map((b) => (
              <li key={b} className="flex items-start gap-3 text-[15px] text-graphite">
                <Check className="mt-0.5 h-4 w-4 shrink-0 text-forest" strokeWidth={2.2} />
                {b}
              </li>
            ))}
          </ul>
        </div>
      </Reveal>
      <Reveal delay={0.1} y={26} className={reverse ? "lg:order-1" : ""}>
        <Mock />
      </Reveal>
    </div>
  );
}

