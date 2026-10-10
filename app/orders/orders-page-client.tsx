"use client";

import { useState, useEffect } from "react";
import { ArrowRight, Check, Printer, Delete as DeleteIcon, ShieldCheck, ArrowRight as FlowArrow } from "lucide-react";
import Reveal from "@/components/reveal";
import Btn from "@/components/landing-btn";
import Header from "@/components/landing-header";
import Footer from "@/components/landing-footer";
import { MockWindow, FeatureRow } from "@/components/feature-page";
import { translations, type Lang } from "@/lib/i18n-landing";
import { getStoredLang, setStoredLang } from "@/lib/i18n-auth";

const CTA_GUY = "/cta-guy.webp";
const REQUEST_ACCESS_HREF = "mailto:hello@zertoo.app?subject=Acceso%20a%20Zertoo%20Orders";

// Ilustraciones simplificadas de cada función (no capturas reales): así
// nunca quedan desactualizadas ni muestran datos de un negocio real.

function BoardMock() {
  const cols = [
    { title: "Nuevos", cards: [{ id: "#A1B2C", meta: "Pickup · $19.00", time: "2m", urgent: false }] },
    {
      title: "En preparación",
      cards: [
        { id: "#K7M2P", meta: "Mesa 4 · $42.50", time: "9m", urgent: false },
        { id: "#Q9X4D", meta: "Delivery · $27.00", time: "23m", urgent: true },
      ],
    },
    { title: "Listos", cards: [{ id: "#T5R8N", meta: "Pickup · $15.50", time: "1m", urgent: false }] },
  ];
  return (
    <MockWindow label="Pedidos en vivo">
      <div className="grid grid-cols-3 gap-2.5">
        {cols.map((c) => (
          <div key={c.title}>
            <p className="mb-2 text-[10px] font-bold uppercase tracking-wide text-graphite/50">{c.title}</p>
            <div className="space-y-2">
              {c.cards.map((card) => (
                <div key={card.id} className="rounded-xl border border-forest/10 bg-white p-2.5">
                  <div className="flex items-center justify-between gap-1">
                    <span className="text-[11px] font-extrabold text-forest">{card.id}</span>
                    <span className={`rounded-full px-1.5 py-0.5 text-[9px] font-bold ${card.urgent ? "bg-coral/15 text-coral" : "bg-forest/[0.06] text-graphite/60"}`}>
                      {card.time}
                    </span>
                  </div>
                  <p className="mt-1 text-[10px] text-graphite/60">{card.meta}</p>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </MockWindow>
  );
}

function EtaMock() {
  return (
    <div className="mx-auto w-full max-w-[340px] space-y-3">
      <div className="rounded-[24px] border border-forest/10 bg-white p-6 shadow-[0_24px_70px_-40px_rgba(0,45,9,0.35)]">
        <p className="text-sm font-extrabold text-forest">¿En cuántos minutos estará listo?</p>
        <div className="mt-4 grid grid-cols-4 gap-2">
          {["10", "15", "20", "30"].map((m, i) => (
            <span
              key={m}
              className={`rounded-xl py-2.5 text-center text-sm font-bold ${i === 2 ? "bg-lime text-forest" : "border border-forest/15 text-graphite"}`}
            >
              {m}
            </span>
          ))}
        </div>
        <span className="mt-4 flex items-center justify-center rounded-xl bg-forest py-3 text-sm font-bold text-white">Aceptar pedido</span>
      </div>
      <div className="ml-auto max-w-[85%] rounded-2xl rounded-tr-sm bg-[#DCF8C6] px-3 py-2 text-[13px] leading-snug text-[#1a1a1a]">
        Tu pedido fue confirmado ✅ Estará listo en 20 minutos.
      </div>
    </div>
  );
}

function TicketsMock() {
  const ticket = (station: string, lines: string[]) => (
    <div className="flex-1 rounded-lg border border-dashed border-forest/25 bg-white p-4 font-mono text-[11px] leading-relaxed text-graphite">
      <div className="mb-2 flex items-center justify-between">
        <span className="font-bold text-forest">{station}</span>
        <Printer className="h-3.5 w-3.5 text-forest" strokeWidth={1.8} />
      </div>
      <p className="mb-2 text-graphite/50">#K7M2P · Mesa 4</p>
      {lines.map((l) => (
        <p key={l}>{l}</p>
      ))}
    </div>
  );
  return (
    <MockWindow label="Impresoras de red">
      <div className="flex gap-3">
        {ticket("COCINA", ["2x Hamburguesa", "  + queso extra", "1x Papas", "  sin sal"])}
        {ticket("BARRA", ["2x Mojito", "1x Limonada", "  poco hielo"])}
      </div>
    </MockWindow>
  );
}

function IpadMock() {
  return (
    <div className="mx-auto w-full max-w-[420px] rounded-[28px] border-[8px] border-forest bg-white p-4 shadow-[0_24px_70px_-40px_rgba(0,45,9,0.35)]">
      <div className="flex items-center justify-between border-b border-forest/[0.07] pb-3">
        <span className="text-xs font-extrabold text-forest">Tu Restaurante</span>
        <span className="text-[10px] font-semibold text-graphite/50">Mesero: Carlos</span>
      </div>
      <div className="mt-3 grid grid-cols-3 gap-2">
        {[1, 2, 3].map((i) => (
          <div key={i} className="space-y-2">
            <div className="h-2 w-10 rounded bg-forest/10" />
            <div className="h-14 rounded-lg bg-lime/25" />
            <div className="h-10 rounded-lg bg-forest/[0.05]" />
          </div>
        ))}
      </div>
      <div className="mt-4 flex items-center justify-around border-t border-forest/[0.07] pt-3">
        {["Pedidos", "Mesas", "Mesero"].map((l, i) => (
          <span key={l} className={`rounded-full px-3 py-1 text-[10px] font-bold ${i === 0 ? "bg-lime text-forest" : "text-graphite/50"}`}>
            {l}
          </span>
        ))}
      </div>
      <p className="mt-3 flex items-center justify-center gap-1.5 text-[10px] font-semibold text-graphite/55">
        <Printer className="h-3 w-3" strokeWidth={1.8} /> Impresora conectada por wifi
      </p>
    </div>
  );
}

function TablesMock() {
  const tables = [
    { n: "1", s: "free" },
    { n: "2", s: "busy", info: "$38.00 · 25m" },
    { n: "3", s: "late", info: "$64.50 · 1h 40m" },
    { n: "4", s: "busy", info: "$22.00 · 8m" },
    { n: "5", s: "free" },
    { n: "6", s: "busy", info: "$51.00 · 46m" },
  ];
  const style: Record<string, string> = {
    free: "border-forest/10 bg-white text-graphite/50",
    busy: "border-lime bg-lime/25 text-forest",
    late: "border-coral/40 bg-coral/10 text-coral",
  };
  return (
    <MockWindow label="Mesas · Salón">
      <div className="grid grid-cols-3 gap-2.5">
        {tables.map((t) => (
          <div key={t.n} className={`rounded-xl border p-3 text-center ${style[t.s]}`}>
            <p className="text-base font-extrabold">Mesa {t.n}</p>
            <p className="mt-0.5 text-[10px] font-semibold">{t.info ?? "Libre"}</p>
          </div>
        ))}
      </div>
    </MockWindow>
  );
}

function PinMock() {
  return (
    <div className="mx-auto w-full max-w-[300px] rounded-[28px] border border-forest/10 bg-white p-6 shadow-[0_24px_70px_-40px_rgba(0,45,9,0.35)]">
      <p className="text-center text-sm font-extrabold text-forest">Ingresa tu PIN</p>
      <div className="mt-4 flex justify-center gap-3">
        {[1, 2, 3, 4].map((i) => (
          <span key={i} className={`h-3.5 w-3.5 rounded-full border-2 ${i <= 3 ? "border-forest bg-forest" : "border-forest/25"}`} />
        ))}
      </div>
      <div className="mt-5 grid grid-cols-3 gap-2.5">
        {["1", "2", "3", "4", "5", "6", "7", "8", "9", "", "0", "⌫"].map((k, i) => (
          <span
            key={i}
            className={`flex h-11 items-center justify-center rounded-xl text-base font-bold ${k ? "bg-forest/[0.05] text-forest" : ""}`}
          >
            {k === "⌫" ? <DeleteIcon className="h-4 w-4" strokeWidth={1.8} /> : k}
          </span>
        ))}
      </div>
    </div>
  );
}

function PaymentMock() {
  return (
    <MockWindow label="Cobrar mesa 4">
      <div className="space-y-1.5 text-sm text-graphite">
        <div className="flex justify-between">
          <span>Total</span>
          <span className="font-bold text-forest">$52.00</span>
        </div>
        <div className="flex justify-between">
          <span>Recibido</span>
          <span>$60.00</span>
        </div>
      </div>
      <div className="mt-4 rounded-2xl bg-lime/25 py-4 text-center">
        <p className="text-[11px] font-bold uppercase tracking-wide text-graphite/60">Cambio</p>
        <p className="text-3xl font-extrabold text-forest">$8.00</p>
      </div>
      <div className="mt-4 flex gap-2">
        <span className="flex-1 rounded-lg bg-lime py-2.5 text-center text-xs font-bold text-forest">Efectivo</span>
        <span className="flex-1 rounded-lg border border-forest/15 py-2.5 text-center text-xs font-bold text-forest">Tarjeta</span>
        <span className="flex-1 rounded-lg border border-forest/15 py-2.5 text-center text-xs font-bold text-forest">Dividir</span>
      </div>
    </MockWindow>
  );
}

function ReceiptMock() {
  return (
    <div className="rounded-[24px] bg-forest/[0.06] px-6 py-10">
    <div className="mx-auto w-full max-w-[280px] bg-white px-6 py-7 font-mono text-[11px] leading-relaxed text-graphite drop-shadow-md [clip-path:polygon(0_0,100%_0,100%_calc(100%-8px),96%_100%,92%_calc(100%-8px),88%_100%,84%_calc(100%-8px),80%_100%,76%_calc(100%-8px),72%_100%,68%_calc(100%-8px),64%_100%,60%_calc(100%-8px),56%_100%,52%_calc(100%-8px),48%_100%,44%_calc(100%-8px),40%_100%,36%_calc(100%-8px),32%_100%,28%_calc(100%-8px),24%_100%,20%_calc(100%-8px),16%_100%,12%_calc(100%-8px),8%_100%,4%_calc(100%-8px),0_100%)]">
      <div className="text-center">
        <div className="mx-auto mb-2 flex h-9 w-9 items-center justify-center rounded-full bg-forest text-xs font-extrabold text-lime">TR</div>
        <p className="font-bold text-forest">Tu Restaurante</p>
        <p className="text-graphite/50">Calle Principal 123</p>
        <p className="mt-1 text-graphite/50">Mesa 4 · Mesero: Carlos</p>
      </div>
      <div className="my-3 border-t border-dashed border-graphite/25" />
      <div className="space-y-1">
        <div className="flex justify-between"><span className="font-bold">2x Hamburguesa</span><span>$28.00</span></div>
        <p className="pl-2 text-graphite/50">+ queso extra</p>
        <div className="flex justify-between"><span className="font-bold">1x Papas</span><span>$6.00</span></div>
      </div>
      <div className="my-3 border-t border-dashed border-graphite/25" />
      <div className="flex justify-between text-sm font-extrabold text-forest"><span>Total</span><span>$34.00</span></div>
      <div className="flex justify-between"><span>Efectivo</span><span>$40.00</span></div>
      <div className="flex justify-between"><span>Cambio</span><span>$6.00</span></div>
      <div className="my-3 border-t border-dashed border-graphite/25" />
      <p className="text-center text-graphite/50">10-10-2026, 8:45 p. m. · #K7M2P</p>
    </div>
    </div>
  );
}

function TeamMock() {
  const rows = [
    { name: "María (cajera)", perms: "Pedidos · Cobro", on: true },
    { name: "Carlos (mesero)", perms: "Solo mesero", on: true },
    { name: "Luis (cocina)", perms: "Solo pedidos", on: false },
  ];
  return (
    <MockWindow label="Equipo y permisos">
      <div className="space-y-3">
        {rows.map((r) => (
          <div key={r.name} className="flex items-center gap-3 rounded-xl border border-forest/10 px-4 py-3">
            <ShieldCheck className="h-4 w-4 shrink-0 text-forest" strokeWidth={1.7} />
            <div className="flex-1">
              <p className="text-sm font-bold text-forest">{r.name}</p>
              <p className="text-xs text-graphite/55">{r.perms}</p>
            </div>
            <span className={`flex h-5 w-9 items-center rounded-full p-0.5 ${r.on ? "bg-lime justify-end" : "bg-forest/15 justify-start"}`}>
              <span className="h-4 w-4 rounded-full bg-white shadow" />
            </span>
          </div>
        ))}
      </div>
    </MockWindow>
  );
}

function FlowMock() {
  const nodes = [
    { name: "Zertoo Menu", desc: "Tu menú y tus precios" },
    { name: "Zertoo Eats", desc: "Te descubren y piden" },
    { name: "Zertoo Orders", desc: "Todo llega al tablero", active: true },
  ];
  return (
    <MockWindow label="Todo conectado">
      <div className="flex flex-col items-stretch gap-2">
        {nodes.map((n, i) => (
          <div key={n.name} className="flex flex-col items-center gap-2">
            <div className={`w-full rounded-xl border px-4 py-3 ${n.active ? "border-forest bg-forest text-white" : "border-forest/15"}`}>
              <p className={`text-sm font-extrabold ${n.active ? "text-lime" : "text-forest"}`}>{n.name}</p>
              <p className={`text-xs ${n.active ? "text-white/70" : "text-graphite/60"}`}>{n.desc}</p>
            </div>
            {i < nodes.length - 1 && <FlowArrow className="h-4 w-4 rotate-90 text-forest/50" strokeWidth={2} />}
          </div>
        ))}
      </div>
    </MockWindow>
  );
}

const MOCKS: Record<string, React.ComponentType> = {
  tablero: BoardMock,
  aceptar: EtaMock,
  cocina: TicketsMock,
  ipad: IpadMock,
  mesas: TablesMock,
  mesero: PinMock,
  cobro: PaymentMock,
  recibo: ReceiptMock,
  equipo: TeamMock,
  conexion: FlowMock,
};

export default function OrdersPageClient() {
  const [lang, setLangState] = useState<Lang>("en");

  useEffect(() => {
    setLangState(getStoredLang());
  }, []);

  function setLang(l: Lang) {
    setLangState(l);
    setStoredLang(l);
  }

  const t = translations[lang];
  const p = t.ordersPage;

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
            <Reveal delay={0.2} y={20}>
              <p className="mx-auto mt-5 inline-flex rounded-full bg-coral/10 px-4 py-1.5 text-[13px] font-bold text-coral">{p.statusNote}</p>
            </Reveal>
            <Reveal delay={0.24} y={20}>
              <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
                <Btn href={REQUEST_ACCESS_HREF}>
                  {p.heroCtaPrimary} <ArrowRight className="h-4 w-4" strokeWidth={2} />
                </Btn>
                <Btn href="/restaurantes" variant="ghost">
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
                    <Btn href={REQUEST_ACCESS_HREF}>
                      {p.ctaPrimary} <ArrowRight className="h-4 w-4" strokeWidth={2} />
                    </Btn>
                    <Btn
                      href="/restaurantes"
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
