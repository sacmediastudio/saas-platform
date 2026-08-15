"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  UtensilsCrossed,
  CalendarCheck,
  Link2,
  ArrowRight,
  Check,
  Plus,
  Nfc,
  Smartphone,
  ShieldCheck,
  Zap,
  Menu,
  X,
} from "lucide-react";
import Reveal from "@/components/reveal";
import { translations, type Lang } from "@/lib/i18n-landing";
import { getStoredLang, setStoredLang } from "@/lib/i18n-auth";

const LOGO = "/logo.svg";
const DASHBOARD = "https://images.hostinger.com/7d431ae5-239d-4f18-8ad3-1a498cd57431.png";
const HERO_CUSTOMER = "/hero-customer.webp";
const CTA_GUY = "/cta-guy.webp";
const STAND = "/nfc-stand.webp";
const NFC_CARD = "/nfc-card.webp";

const PRODUCT_ICONS = [UtensilsCrossed, CalendarCheck, Link2];
const PLAN_TYPES = ["SMARTLINK", "SMALL_BUSINESS", "RESTAURANT"];

function Btn({ children, variant = "primary", className = "", as: As = "a", ...rest }: any) {
  const base =
    "inline-flex items-center justify-center gap-2 rounded-2xl px-7 min-h-[52px] text-[15px] font-semibold transition-all duration-200 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-forest/30";
  const styles: Record<string, string> = {
    primary: "bg-lime text-forest hover:-translate-y-0.5 hover:brightness-105",
    dark: "bg-forest text-white hover:-translate-y-0.5 hover:bg-forest/90",
    ghost: "border border-forest/15 text-forest hover:-translate-y-0.5 hover:border-forest/40 hover:bg-forest/[0.03]",
  };
  return (
    <As className={`${base} ${styles[variant]} ${className}`} {...rest}>
      {children}
    </As>
  );
}

function LangSwitch({ lang, setLang }: { lang: Lang; setLang: (l: Lang) => void }) {
  return (
    <div className="flex items-center rounded-full border border-forest/15 p-0.5 text-xs font-bold">
      {(["EN", "ES"] as const).map((l) => {
        const value = l.toLowerCase() as Lang;
        const active = lang === value;
        return (
          <button
            key={l}
            type="button"
            onClick={() => setLang(value)}
            className={`px-2.5 py-1 rounded-full transition-colors ${active ? "bg-forest text-white" : "text-forest/60"}`}
          >
            {l}
          </button>
        );
      })}
    </div>
  );
}

function Header({ lang, setLang, t }: { lang: Lang; setLang: (l: Lang) => void; t: (typeof translations)["en"] }) {
  const [open, setOpen] = useState(false);
  const nav = [
    { label: t.nav.products, href: "#productos" },
    { label: t.nav.hardware, href: "#hardware" },
    { label: t.nav.pricing, href: "#precios" },
    { label: t.nav.faq, href: "#faq" },
  ];
  return (
    <header className="sticky top-0 z-50 border-b border-forest/[0.07] bg-white/85 backdrop-blur-xl">
      <div className="mx-auto flex h-[76px] w-full max-w-[90rem] items-center justify-between px-6 lg:px-10">
        <a href="#top" className="flex items-center" aria-label="Zertoo">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={LOGO} alt="Zertoo" className="h-10 w-auto" />
        </a>
        <nav className="hidden items-center gap-9 md:flex">
          {nav.map((n) => (
            <a key={n.href} href={n.href} className="relative text-sm font-medium text-graphite transition-colors hover:text-forest">
              {n.label}
            </a>
          ))}
        </nav>
        <div className="hidden items-center gap-4 md:flex">
          <LangSwitch lang={lang} setLang={setLang} />
          <a href="#precios" className="text-sm font-semibold text-forest hover:opacity-70">{t.nav.viewPlans}</a>
          <a href="/login" className="text-sm font-semibold text-forest hover:opacity-70">{t.nav.login}</a>
          <Btn href="/signup" className="px-5 min-h-[44px]">{t.nav.start}</Btn>
        </div>
        <div className="flex items-center gap-2 md:hidden">
          <LangSwitch lang={lang} setLang={setLang} />
          <button type="button" onClick={() => setOpen((v) => !v)} className="-mr-2 p-2 text-forest" aria-label="Menu">
            {open ? <X className="h-6 w-6" strokeWidth={1.6} /> : <Menu className="h-6 w-6" strokeWidth={1.6} />}
          </button>
        </div>
      </div>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.22, ease: "easeOut" }}
            className="overflow-hidden border-t border-forest/[0.07] bg-white md:hidden"
          >
            <div className="flex flex-col gap-1 px-6 py-5">
              {nav.map((n) => (
                <a key={n.href} href={n.href} onClick={() => setOpen(false)} className="py-3 text-base font-medium text-forest">
                  {n.label}
                </a>
              ))}
              <a href="/login" onClick={() => setOpen(false)} className="py-3 text-base font-medium text-forest">
                {t.nav.login}
              </a>
              <Btn href="/signup" onClick={() => setOpen(false)} className="mt-3 w-full">{t.nav.start}</Btn>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}

function Hero({ t }: { t: (typeof translations)["en"] }) {
  return (
    <section id="top" className="relative overflow-hidden">
      <div className="pointer-events-none absolute -right-40 -top-40 h-[520px] w-[520px] rounded-full bg-lime/20 blur-[120px]" />
      <div className="mx-auto grid w-full max-w-[90rem] items-center gap-16 px-6 pb-24 pt-16 lg:grid-cols-[1.05fr_1fr] lg:gap-10 lg:px-10 lg:pb-32 lg:pt-24">
        <div>
          <Reveal y={16}>
            <span className="inline-flex items-center gap-2 rounded-full border border-forest/10 bg-white px-4 py-1.5 text-[13px] font-semibold text-forest">
              <span className="h-1.5 w-1.5 rounded-full bg-lime" />
              {t.hero.badge}
            </span>
          </Reveal>
          <Reveal delay={0.08} y={20}>
            <h1 className="mt-7 max-w-[19ch] text-[clamp(2.6rem,6vw,4.5rem)] font-extrabold leading-[0.98] tracking-[-0.035em] text-forest">
              {t.hero.titlePrefix}{" "}
              <span className="relative inline-block">
                <span className="relative z-10">{t.hero.titleHighlight}</span>
                <motion.span
                  initial={{ scaleX: 0 }}
                  whileInView={{ scaleX: 1 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.6, delay: 0.5, ease: "easeOut" }}
                  style={{ originX: 0 }}
                  className="absolute bottom-1 left-0 z-0 h-[0.42em] w-full rounded-sm bg-lime"
                />
              </span>
            </h1>
          </Reveal>
          <Reveal delay={0.16} y={20}>
            <p className="mt-7 max-w-[54ch] text-lg leading-relaxed text-graphite">{t.hero.subtitle}</p>
          </Reveal>
          <Reveal delay={0.24} y={20}>
            <div className="mt-10 flex flex-col gap-3 sm:flex-row">
              <Btn href="/signup">
                {t.hero.ctaPrimary} <ArrowRight className="h-4 w-4" strokeWidth={2} />
              </Btn>
              <Btn href="#precios" variant="ghost">{t.hero.ctaSecondary}</Btn>
            </div>
            <p className="mt-5 text-sm text-graphite/70">{t.hero.note}</p>
          </Reveal>
        </div>
        <Reveal delay={0.2} y={28}>
          <div className="relative">
            <div className="zt-float relative">
              <div className="absolute -inset-6 rounded-[2.5rem] bg-forest/[0.04] blur-2xl" />
              <div className="relative overflow-hidden rounded-[24px] border border-forest/10 bg-white shadow-[0_24px_70px_-40px_rgba(0,45,9,0.35)]">
                <div className="flex items-center gap-1.5 border-b border-forest/[0.07] px-5 py-3.5">
                  <span className="h-2.5 w-2.5 rounded-full bg-forest/10" />
                  <span className="h-2.5 w-2.5 rounded-full bg-forest/10" />
                  <span className="h-2.5 w-2.5 rounded-full bg-forest/10" />
                  <span className="ml-3 text-xs font-medium text-graphite/60">{t.hero.panelUrl}</span>
                </div>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={DASHBOARD} alt="Zertoo dashboard" className="block w-full" loading="eager" />
              </div>
              <div className="absolute -bottom-6 -left-4 hidden rounded-2xl border border-forest/10 bg-white px-5 py-4 shadow-[0_18px_40px_-28px_rgba(0,45,9,0.4)] sm:block">
                <p className="text-xs font-medium text-graphite/70">{t.hero.publishedIn}</p>
                <p className="text-xl font-extrabold tracking-tight text-forest">8 min</p>
              </div>
            </div>
            {/* Foto estática a propósito (sin zt-float) — queda fija sobre
                la marquesina mientras el mockup de arriba sigue flotando. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={HERO_CUSTOMER}
              alt=""
              aria-hidden="true"
              className="pointer-events-none absolute -bottom-20 -right-6 hidden h-auto w-[300px] drop-shadow-[0_20px_35px_rgba(0,45,9,0.28)] sm:block md:-bottom-16 md:w-[350px] lg:-bottom-28 lg:-right-4 lg:w-[420px] xl:-bottom-32 xl:w-[460px]"
            />
          </div>
        </Reveal>
      </div>
      <div className="border-y border-forest/[0.07] py-5">
        <div className="flex w-max zt-marquee gap-14 pr-14">
          {[0, 1].map((k) => (
            <div key={k} className="flex gap-14 pr-14" aria-hidden={k === 1}>
              {t.ticker.map((item) => (
                <span key={item} className="flex items-center gap-3 whitespace-nowrap text-sm font-semibold uppercase tracking-[0.18em] text-graphite/45">
                  {item}
                  <span className="h-1 w-1 rounded-full bg-lime" />
                </span>
              ))}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function ProductCard({ p, index, moreInfoLabel }: { p: any; index: number; moreInfoLabel: string }) {
  const Icon = PRODUCT_ICONS[index];
  return (
    <Reveal delay={index * 0.08} y={24} className="min-w-[86vw] snap-center sm:min-w-0">
      <div className="group flex h-full flex-col rounded-[24px] border border-forest/10 bg-white p-8 transition-all duration-200 hover:-translate-y-1 hover:border-forest/25">
        <div className="flex items-center justify-between">
          <span className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-forest/[0.05] text-forest transition-colors duration-200 group-hover:bg-lime">
            <Icon className="h-5 w-5" strokeWidth={1.6} />
          </span>
          <span className="text-[13px] font-semibold uppercase tracking-[0.14em] text-graphite/45">{p.id}</span>
        </div>
        <h3 className="mt-7 text-2xl font-extrabold tracking-tight text-forest">{p.name}</h3>
        <p className="mt-2 text-[15px] leading-relaxed text-graphite">{p.desc}</p>
        <p className="mt-6 flex items-baseline gap-1.5">
          <span className="text-4xl font-extrabold tracking-tight text-forest">${p.price}</span>
          <span className="text-sm font-medium text-graphite/70">/mo</span>
        </p>
        <ul className="mt-7 space-y-3 border-t border-forest/[0.07] pt-7">
          {p.benefits.map((b: string) => (
            <li key={b} className="flex items-start gap-3 text-[15px] text-graphite">
              <Check className="mt-0.5 h-4 w-4 shrink-0 text-forest" strokeWidth={2.2} />
              {b}
            </li>
          ))}
        </ul>
        <Btn href="#precios" variant="ghost" className="mt-8 w-full">{moreInfoLabel}</Btn>
      </div>
    </Reveal>
  );
}

function Products({ t }: { t: (typeof translations)["en"] }) {
  return (
    <section id="productos" className="mx-auto w-full max-w-[90rem] px-6 py-24 lg:px-10 lg:py-32">
      <Reveal y={18}>
        <h2 className="max-w-[24ch] text-[clamp(2rem,4vw,3.25rem)] font-extrabold leading-[1.03] tracking-[-0.03em] text-forest">
          {t.products.title}
        </h2>
        <p className="mt-6 max-w-[58ch] text-lg leading-relaxed text-graphite">{t.products.subtitle}</p>
      </Reveal>
      <div className="no-scrollbar mt-14 flex snap-x snap-mandatory gap-6 overflow-x-auto pb-2 sm:grid sm:grid-cols-3 sm:overflow-visible">
        {t.products.items.map((p, i) => (
          <ProductCard key={p.id} p={p} index={i} moreInfoLabel={t.products.moreInfo} />
        ))}
      </div>
    </section>
  );
}

function Hardware({ t }: { t: (typeof translations)["en"] }) {
  const images = [STAND, NFC_CARD];
  return (
    <section id="hardware" className="bg-[#F7F8F4] py-24 lg:py-32">
      <div className="mx-auto w-full max-w-[90rem] px-6 lg:px-10">
        <Reveal y={18}>
          <div className="flex flex-wrap items-end justify-between gap-8">
            <div>
              <span className="inline-flex items-center gap-2 text-[13px] font-semibold uppercase tracking-[0.16em] text-graphite/55">
                <Nfc className="h-4 w-4" strokeWidth={1.6} /> {t.hardware.badge}
              </span>
              <h2 className="mt-5 max-w-[22ch] text-[clamp(2rem,4vw,3.25rem)] font-extrabold leading-[1.03] tracking-[-0.03em] text-forest">
                {t.hardware.title}
              </h2>
            </div>
            <p className="max-w-[42ch] text-lg leading-relaxed text-graphite">{t.hardware.subtitle}</p>
          </div>
        </Reveal>
        <div className="mt-14 grid gap-6 lg:grid-cols-2">
          {t.hardware.items.map((h, i) => (
            <Reveal key={h.title} delay={i * 0.1} y={26}>
              <article className="group flex h-full flex-col overflow-hidden rounded-[24px] border border-forest/[0.08] bg-white">
                <div className="overflow-hidden">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={images[i]}
                    alt={h.title}
                    loading="lazy"
                    className="aspect-[4/3] w-full object-cover transition-transform duration-500 ease-out group-hover:scale-[1.03]"
                  />
                </div>
                <div className="flex flex-1 flex-col p-8 lg:p-10">
                  <span className="text-[13px] font-semibold uppercase tracking-[0.14em] text-graphite/50">{h.eyebrow}</span>
                  <h3 className="mt-3 text-3xl font-extrabold tracking-tight text-forest">{h.title}</h3>
                  <p className="mt-4 text-[15px] leading-relaxed text-graphite">{h.copy}</p>
                  <ul className="mt-7 grid gap-3 sm:grid-cols-2">
                    {h.bullets.map((b) => (
                      <li key={b} className="flex items-start gap-2.5 text-[15px] text-graphite">
                        <Check className="mt-0.5 h-4 w-4 shrink-0 text-forest" strokeWidth={2.2} />
                        {b}
                      </li>
                    ))}
                  </ul>
                  <div className="mt-9 flex flex-wrap items-center justify-between gap-4 border-t border-forest/[0.07] pt-7">
                    <span className="text-xl font-extrabold tracking-tight text-forest">{h.price}</span>
                    <Btn href="#faq" variant="dark" className="px-6 min-h-[46px]">{t.hardware.consult}</Btn>
                  </div>
                </div>
              </article>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

function Pricing({ t }: { t: (typeof translations)["en"] }) {
  return (
    <section id="precios" className="mx-auto w-full max-w-[90rem] px-6 py-24 lg:px-10 lg:py-32">
      <Reveal y={18}>
        <div className="max-w-[46rem]">
          <h2 className="text-[clamp(2rem,4vw,3.25rem)] font-extrabold leading-[1.03] tracking-[-0.03em] text-forest">
            {t.pricing.title}
          </h2>
          <p className="mt-6 text-lg leading-relaxed text-graphite">{t.pricing.subtitle}</p>
        </div>
      </Reveal>
      <div className="no-scrollbar mt-14 flex snap-x snap-mandatory gap-6 overflow-x-auto pb-2 lg:grid lg:grid-cols-3 lg:overflow-visible">
        {t.pricing.plans.map((p, i) => (
          <Reveal key={p.name} delay={i * 0.08} y={24} className="min-w-[86vw] snap-center lg:min-w-0">
            <div className={`flex h-full flex-col rounded-[24px] p-9 transition-all duration-200 hover:-translate-y-1 ${p.highlight ? "bg-forest text-white" : "border border-forest/10 bg-white"}`}>
              <div className="flex items-center justify-between gap-3">
                <h3 className={`text-lg font-bold tracking-tight ${p.highlight ? "text-white" : "text-forest"}`}>{p.name}</h3>
                {p.highlight && (
                  <span className="rounded-full bg-coral px-3 py-1 text-[12px] font-bold uppercase tracking-[0.1em] text-white">{t.pricing.mostChosen}</span>
                )}
              </div>
              <p className={`mt-1.5 text-sm ${p.highlight ? "text-white/65" : "text-graphite/70"}`}>{p.for}</p>
              <p className="mt-8 flex items-baseline gap-1.5">
                <span className={`text-[3.4rem] font-extrabold leading-none tracking-[-0.04em] ${p.highlight ? "text-lime" : "text-forest"}`}>${p.price}</span>
                <span className={`text-sm font-medium ${p.highlight ? "text-white/60" : "text-graphite/70"}`}>{t.pricing.perMonth}</span>
              </p>
              <ul className={`mt-8 flex-1 space-y-3 border-t pt-8 ${p.highlight ? "border-white/12" : "border-forest/[0.07]"}`}>
                {p.points.map((pt) => (
                  <li key={pt} className={`flex items-start gap-3 text-[15px] ${p.highlight ? "text-white/85" : "text-graphite"}`}>
                    <Check className={`mt-0.5 h-4 w-4 shrink-0 ${p.highlight ? "text-lime" : "text-forest"}`} strokeWidth={2.2} />
                    {pt}
                  </li>
                ))}
              </ul>
              <Btn href={`/signup?type=${PLAN_TYPES[i]}`} variant={p.highlight ? "primary" : "dark"} className="mt-9 w-full">
                {t.pricing.start}
              </Btn>
            </div>
          </Reveal>
        ))}
      </div>
      <Reveal delay={0.1} y={18}>
        <div className="mt-8 flex flex-wrap items-center gap-x-8 gap-y-3 text-sm text-graphite/75">
          <span className="flex items-center gap-2"><ShieldCheck className="h-4 w-4 text-forest" strokeWidth={1.7} /> {t.pricing.trust[0]}</span>
          <span className="flex items-center gap-2"><Zap className="h-4 w-4 text-forest" strokeWidth={1.7} /> {t.pricing.trust[1]}</span>
          <span className="flex items-center gap-2"><Smartphone className="h-4 w-4 text-forest" strokeWidth={1.7} /> {t.pricing.trust[2]}</span>
        </div>
      </Reveal>
    </section>
  );
}

function Faq({ t }: { t: (typeof translations)["en"] }) {
  const [open, setOpen] = useState(0);
  return (
    <section id="faq" className="border-t border-forest/[0.07]">
      <div className="mx-auto grid w-full max-w-[80rem] gap-12 px-6 py-24 lg:grid-cols-[0.8fr_1.2fr] lg:px-10 lg:py-32">
        <Reveal y={18}>
          <h2 className="text-[clamp(2rem,3.4vw,2.75rem)] font-extrabold leading-[1.05] tracking-[-0.03em] text-forest">{t.faq.title}</h2>
          <p className="mt-5 max-w-[34ch] text-[15px] leading-relaxed text-graphite">{t.faq.subtitle}</p>
        </Reveal>
        <Reveal delay={0.08} y={18}>
          <div className="divide-y divide-forest/[0.09] border-t border-forest/[0.09]">
            {t.faq.items.map((f, i) => {
              const isOpen = open === i;
              return (
                <div key={f.q}>
                  <button
                    type="button"
                    onClick={() => setOpen(isOpen ? -1 : i)}
                    aria-expanded={isOpen}
                    className="flex w-full items-start justify-between gap-6 py-6 text-left"
                  >
                    <span className="text-[17px] font-semibold tracking-tight text-forest">{f.q}</span>
                    <Plus className={`mt-0.5 h-5 w-5 shrink-0 text-forest transition-transform duration-200 ${isOpen ? "rotate-45" : ""}`} strokeWidth={1.8} />
                  </button>
                  <AnimatePresence initial={false}>
                    {isOpen && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.24, ease: "easeOut" }}
                        className="overflow-hidden"
                      >
                        <p className="max-w-[62ch] pb-7 pr-10 text-[15px] leading-relaxed text-graphite">{f.a}</p>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              );
            })}
          </div>
        </Reveal>
      </div>
    </section>
  );
}

function CtaBand({ t }: { t: (typeof translations)["en"] }) {
  return (
    <section className="mx-auto w-full max-w-[90rem] px-6 pb-24 lg:px-10 lg:pb-32">
      <Reveal y={22}>
        <div className="relative overflow-hidden rounded-[24px] bg-forest p-8 lg:p-14">
          <div className="pointer-events-none absolute -left-24 -top-24 h-72 w-72 rounded-full bg-lime/15 blur-[90px]" />
          <div className="relative grid items-center gap-10 lg:grid-cols-3 lg:gap-8">
            <div className="flex justify-center lg:col-span-1">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={CTA_GUY}
                alt=""
                aria-hidden="true"
                className="h-auto w-[240px] sm:w-[280px] lg:w-[320px] xl:w-[360px]"
              />
            </div>
            <div className="text-center lg:col-span-2 lg:text-left">
              <h2 className="mx-auto max-w-[24ch] text-[clamp(1.9rem,3.6vw,3rem)] font-extrabold leading-[1.05] tracking-[-0.03em] text-white lg:mx-0">
                {t.ctaBand.title}
              </h2>
              <p className="mx-auto mt-5 max-w-[48ch] text-lg text-white/70 lg:mx-0">{t.ctaBand.subtitle}</p>
              <div className="mt-9 flex flex-col justify-center gap-3 sm:flex-row lg:justify-start">
                <Btn href="/signup">
                  {t.ctaBand.primary} <ArrowRight className="h-4 w-4" strokeWidth={2} />
                </Btn>
                <Btn href="#productos" className="border border-white/20 bg-transparent text-white hover:-translate-y-0.5 hover:bg-white/10" variant="ghost">
                  {t.ctaBand.secondary}
                </Btn>
              </div>
            </div>
          </div>
        </div>
      </Reveal>
    </section>
  );
}

function Footer({ t }: { t: (typeof translations)["en"] }) {
  return (
    <footer className="border-t border-forest/[0.07] bg-white">
      <div className="mx-auto flex w-full max-w-[90rem] flex-col gap-10 px-6 py-14 lg:flex-row lg:items-center lg:justify-between lg:px-10">
        <div>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={LOGO} alt="Zertoo" className="h-6 w-auto" />
          <p className="mt-4 max-w-[34ch] text-sm text-graphite/70">{t.footer.tagline}</p>
        </div>
        <nav className="flex flex-wrap gap-x-8 gap-y-3 text-sm font-medium text-graphite">
          <a href="mailto:hola@zertoo.com" className="transition-colors hover:text-forest">{t.footer.contact}</a>
          <a href="#productos" className="transition-colors hover:text-forest">{t.footer.products}</a>
          <a href="#precios" className="transition-colors hover:text-forest">{t.footer.pricing}</a>
          <a href="#faq" className="transition-colors hover:text-forest">{t.footer.faq}</a>
          <a href="https://instagram.com" target="_blank" rel="noreferrer" className="transition-colors hover:text-forest">Instagram</a>
          <a href="https://wa.me/" target="_blank" rel="noreferrer" className="transition-colors hover:text-forest">WhatsApp</a>
        </nav>
      </div>
      <div className="mx-auto w-full max-w-[90rem] border-t border-forest/[0.07] px-6 py-6 lg:px-10">
        <p className="text-xs text-graphite/60">© {new Date().getFullYear()} Zertoo. {t.footer.copyright}</p>
      </div>
    </footer>
  );
}

export default function HomePage() {
  const [lang, setLangState] = useState<Lang>("en");

  // Al montar, recupera el idioma que la persona haya elegido antes
  // (en esta misma visita o en una anterior), para que la landing no
  // "olvide" su preferencia si vuelve a entrar.
  useEffect(() => {
    setLangState(getStoredLang());
  }, []);

  function setLang(l: Lang) {
    setLangState(l);
    setStoredLang(l);
  }

  const t = translations[lang];

  return (
    <div className="min-h-screen bg-white">
      <Header lang={lang} setLang={setLang} t={t} />
      <main>
        <Hero t={t} />
        <Products t={t} />
        <Hardware t={t} />
        <Pricing t={t} />
        <Faq t={t} />
        <CtaBand t={t} />
      </main>
      <Footer t={t} />
    </div>
  );
}
