"use client";

import { useState, useEffect } from "react";
import { ArrowRight, Check, MapPin, Gift, Star, Heart, Stamp } from "lucide-react";
import Reveal from "@/components/reveal";
import Btn from "@/components/landing-btn";
import Header from "@/components/landing-header";
import Footer from "@/components/landing-footer";
import { translations, type Lang } from "@/lib/i18n-landing";
import { getStoredLang, setStoredLang } from "@/lib/i18n-auth";

const CTA_GUY = "/cta-guy.webp";

// Mismo "browser chrome" que usa el Hero de la home (barra con 3
// puntos + url falsa) — acá envuelve una ilustración simplificada de
// cada feature en vez de una captura real, así nunca queda desactualizado
// ni expone datos de un negocio real.
function MockWindow({ label, children }: { label: string; children: React.ReactNode }) {
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

function MenuMock() {
  const dishes = [
    { name: "Bandeja paisa", price: "$18.50" },
    { name: "Sobrebarriga en salsa", price: "$16.00" },
    { name: "Combinado con chorizo", price: "$14.90" },
  ];
  return (
    <MockWindow label="zertoo.app/menu/tu-restaurante">
      <div className="flex flex-col gap-4">
        {dishes.map((d) => (
          <div key={d.name} className="flex items-center gap-3">
            <div className="h-14 w-14 shrink-0 rounded-xl bg-lime/25" />
            <div className="flex-1">
              <p className="text-sm font-bold text-forest">{d.name}</p>
              <p className="text-xs text-graphite/50">★ Destacado</p>
            </div>
            <span className="text-sm font-extrabold text-forest">{d.price}</span>
          </div>
        ))}
      </div>
    </MockWindow>
  );
}

function OrderMock() {
  return (
    <MockWindow label="Tu pedido">
      <div className="mb-4 flex gap-2">
        <span className="flex-1 rounded-lg border border-forest py-2 text-center text-xs font-bold text-forest">Pickup</span>
        <span className="flex-1 rounded-lg border border-forest/15 py-2 text-center text-xs font-medium text-graphite/45">Delivery</span>
      </div>
      <div className="space-y-2 text-sm text-graphite">
        <div className="flex justify-between">
          <span>2x Combinado con chorizo</span>
          <span>$29.80</span>
        </div>
        <div className="flex justify-between">
          <span>1x Jugo natural</span>
          <span>$3.50</span>
        </div>
      </div>
      <div className="mt-4 flex justify-between border-t border-forest/10 pt-3 text-base font-extrabold text-forest">
        <span>Total</span>
        <span>$33.30</span>
      </div>
    </MockWindow>
  );
}

function LocationsMock() {
  const locations = ["Centro", "Playa", "Norte"];
  return (
    <MockWindow label="Elige tu ubicación">
      <div className="space-y-2.5">
        {locations.map((n, i) => (
          <div
            key={n}
            className={`flex items-center gap-3 rounded-xl border px-4 py-3 ${i === 0 ? "border-forest bg-forest/[0.03]" : "border-forest/10"}`}
          >
            <MapPin className="h-4 w-4 text-forest" strokeWidth={1.8} />
            <span className="text-sm font-semibold text-forest">{n}</span>
            {i === 0 && <Check className="ml-auto h-4 w-4 text-forest" strokeWidth={2.2} />}
          </div>
        ))}
      </div>
    </MockWindow>
  );
}

function WhatsAppMock() {
  return (
    <div className="mx-auto w-full max-w-[300px] overflow-hidden rounded-[32px] border-[6px] border-forest bg-white shadow-[0_24px_70px_-40px_rgba(0,45,9,0.35)]">
      <div className="bg-[#075E54] px-4 py-3">
        <p className="text-sm font-bold text-white">Tu Restaurante</p>
        <p className="text-[11px] text-white/70">WhatsApp Business</p>
      </div>
      <div className="flex min-h-[220px] flex-col justify-end gap-2 bg-[#ECE5DD] p-4">
        <div className="max-w-[85%] self-end rounded-2xl rounded-tr-sm bg-[#DCF8C6] px-3 py-2 text-[13px] leading-snug text-[#1a1a1a]">
          Tu pedido fue confirmado ✅ Estará listo en 20 minutos.
        </div>
        <div className="max-w-[85%] self-end rounded-2xl rounded-tr-sm bg-[#DCF8C6] px-3 py-2 text-[13px] leading-snug text-[#1a1a1a]">
          🎉 Tu pedido ya está listo. ¡Te esperamos!
        </div>
      </div>
    </div>
  );
}

function CustomersMock() {
  return (
    <MockWindow label="Tu página pública">
      <div className="flex flex-col gap-4">
        <div className="flex items-center gap-3 rounded-xl bg-lime/20 px-4 py-3">
          <Gift className="h-5 w-5 shrink-0 text-forest" strokeWidth={1.7} />
          <p className="text-sm font-semibold text-forest">🎁 Postre gratis en tu próxima visita</p>
        </div>
        <div className="flex items-center gap-1">
          {[1, 2, 3, 4, 5].map((i) => (
            <Star key={i} className="h-4 w-4 fill-lime text-lime" strokeWidth={0} />
          ))}
          <span className="ml-2 text-xs text-graphite/60">4.9 · 128 reseñas</span>
        </div>
        <div className="flex items-center gap-2 text-sm text-graphite">
          <Heart className="h-4 w-4 fill-coral text-coral" strokeWidth={0} /> 3 platos favoritos guardados
        </div>
      </div>
    </MockWindow>
  );
}

function LoyaltyMock() {
  return (
    <MockWindow label="Tu tarjeta de sellos">
      <div className="rounded-2xl bg-forest p-5 text-white">
        <div className="flex items-center justify-between">
          <p className="text-sm font-bold">Tu Restaurante</p>
          <Stamp className="h-5 w-5 text-lime" strokeWidth={1.7} />
        </div>
        <div className="mt-5 flex gap-2">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <span key={i} className={`h-7 w-7 rounded-full border-2 ${i <= 4 ? "border-lime bg-lime" : "border-white/25"}`} />
          ))}
        </div>
        <p className="mt-4 text-xs text-white/70">4 de 6 sellos — ¡2 más para tu premio!</p>
      </div>
      <div className="mt-4 flex gap-2">
        <div className="flex-1 rounded-lg border border-forest/15 py-2.5 text-center text-xs font-bold text-forest">Apple Wallet</div>
        <div className="flex-1 rounded-lg border border-forest/15 py-2.5 text-center text-xs font-bold text-forest">Google Wallet</div>
      </div>
    </MockWindow>
  );
}

function StatsMock() {
  const bars = [40, 65, 50, 80, 55, 95, 70];
  return (
    <MockWindow label="Estadísticas de pedidos">
      <div className="mb-4 flex items-center justify-between">
        <span className="text-xs font-semibold text-graphite/60">Personalizado ⌄</span>
        <span className="text-[11px] text-graphite/45">1 – 15 Sep</span>
      </div>
      <div className="flex h-24 items-end gap-2">
        {bars.map((h, i) => (
          <div key={i} className="flex-1 rounded-t-md bg-lime" style={{ height: `${h}%` }} />
        ))}
      </div>
      <p className="mt-3 text-xs font-bold text-forest">↑ 32% vs. período anterior</p>
    </MockWindow>
  );
}

function EatsMock() {
  return (
    <MockWindow label="zertooeats.com">
      <div className="overflow-hidden rounded-2xl border border-forest/10">
        <div className="h-24 bg-gradient-to-br from-lime/50 to-forest/10" />
        <div className="p-4">
          <p className="text-sm font-bold text-forest">Tu Restaurante</p>
          <p className="text-xs text-graphite/60">Comida colombiana · $$</p>
          <div className="mt-2 flex items-center gap-1">
            {[1, 2, 3, 4, 5].map((i) => (
              <Star key={i} className="h-3.5 w-3.5 fill-lime text-lime" strokeWidth={0} />
            ))}
          </div>
        </div>
      </div>
    </MockWindow>
  );
}

const MOCKS: Record<string, React.ComponentType> = {
  menu: MenuMock,
  pedidos: OrderMock,
  ubicaciones: LocationsMock,
  whatsapp: WhatsAppMock,
  clientes: CustomersMock,
  loyalty: LoyaltyMock,
  metricas: StatsMock,
  eats: EatsMock,
};

function FeatureRow({
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

export default function RestaurantPageClient() {
  const [lang, setLangState] = useState<Lang>("en");

  useEffect(() => {
    setLangState(getStoredLang());
  }, []);

  function setLang(l: Lang) {
    setLangState(l);
    setStoredLang(l);
  }

  const t = translations[lang];
  const p = t.restaurantPage;

  return (
    <div className="min-h-screen bg-white">
      <Header lang={lang} setLang={setLang} t={t} />
      <main>
        <section className="relative overflow-hidden">
          <div className="pointer-events-none absolute -right-40 -top-40 h-[520px] w-[520px] rounded-full bg-lime/20 blur-[120px]" />
          <div className="mx-auto w-full max-w-[70rem] px-6 pb-20 pt-16 text-center lg:px-10 lg:pb-28 lg:pt-24">
            <Reveal y={16}>
              <span className="inline-flex items-center gap-2 rounded-full border border-forest/10 bg-white px-4 py-1.5 text-[13px] font-semibold text-forest">
                <span className="h-1.5 w-1.5 rounded-full bg-lime" />
                {p.badge}
              </span>
            </Reveal>
            <Reveal delay={0.08} y={20}>
              <h1 className="mx-auto mt-7 max-w-[22ch] text-[clamp(2.4rem,5.5vw,4rem)] font-extrabold leading-[1.02] tracking-[-0.035em] text-forest">
                {p.heroTitlePrefix} <span className="text-coral">{p.heroTitleHighlight}</span>
              </h1>
            </Reveal>
            <Reveal delay={0.16} y={20}>
              <p className="mx-auto mt-7 max-w-[56ch] text-lg leading-relaxed text-graphite">{p.heroSubtitle}</p>
            </Reveal>
            <Reveal delay={0.24} y={20}>
              <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
                <Btn href="/signup?type=RESTAURANT">
                  {p.heroCtaPrimary} <ArrowRight className="h-4 w-4" strokeWidth={2} />
                </Btn>
                <Btn href="/#precios" variant="ghost">
                  {p.heroCtaSecondary}
                </Btn>
              </div>
            </Reveal>
          </div>
        </section>

        <div className="mx-auto flex w-full max-w-[90rem] flex-col gap-24 px-6 pb-24 lg:gap-32 lg:px-10 lg:pb-32">
          {p.sections.map((s, i) => (
            <FeatureRow
              key={s.id}
              index={i}
              title={s.title}
              subtitle={s.subtitle}
              bullets={s.bullets}
              isNew={s.isNew}
              newLabel={p.newBadge}
              Mock={MOCKS[s.id]}
            />
          ))}
        </div>

        <section className="mx-auto w-full max-w-[90rem] px-6 pb-24 lg:px-10 lg:pb-32">
          <Reveal y={22}>
            <div className="relative overflow-hidden rounded-[24px] bg-forest p-8 lg:p-14">
              <div className="pointer-events-none absolute -left-24 -top-24 h-72 w-72 rounded-full bg-lime/15 blur-[90px]" />
              <div className="relative grid items-center gap-10 lg:grid-cols-3 lg:gap-8">
                <div className="flex justify-center lg:col-span-1">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={CTA_GUY} alt="" aria-hidden="true" className="h-auto w-[240px] sm:w-[280px] lg:w-[320px] xl:w-[360px]" />
                </div>
                <div className="text-center lg:col-span-2 lg:text-left">
                  <h2 className="mx-auto max-w-[24ch] text-[clamp(1.9rem,3.6vw,3rem)] font-extrabold leading-[1.05] tracking-[-0.03em] text-white lg:mx-0">
                    {p.ctaTitle}
                  </h2>
                  <p className="mx-auto mt-5 max-w-[48ch] text-lg text-white/70 lg:mx-0">{p.ctaSubtitle}</p>
                  <div className="mt-9 flex flex-col justify-center gap-3 sm:flex-row lg:justify-start">
                    <Btn href="/signup?type=RESTAURANT">
                      {p.ctaPrimary} <ArrowRight className="h-4 w-4" strokeWidth={2} />
                    </Btn>
                    <Btn
                      href="/#precios"
                      className="border border-white/20 bg-transparent text-white hover:-translate-y-0.5 hover:bg-white/10"
                      variant="ghost"
                    >
                      {p.ctaSecondary}
                    </Btn>
                  </div>
                </div>
              </div>
            </div>
          </Reveal>
        </section>
      </main>
      <Footer t={t} />
    </div>
  );
}
