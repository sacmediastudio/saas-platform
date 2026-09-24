"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Menu, X } from "lucide-react";
import Btn from "@/components/landing-btn";
import LangSwitch from "@/components/landing-lang-switch";
import type { translations, Lang } from "@/lib/i18n-landing";

const LOGO = "/logo.svg";

// Los anchors (#productos, #hardware, etc.) solo existen en la home —
// por eso llevan el "/" adelante: así funcionan igual si el header se
// usa en otra página (navega a la home y después salta al ancla) que
// si ya estás en la home (queda como un scroll normal, sin recargar).
export default function Header({ lang, setLang, t }: { lang: Lang; setLang: (l: Lang) => void; t: (typeof translations)["en"] }) {
  const [open, setOpen] = useState(false);
  const nav = [
    { label: t.nav.products, href: "/#productos" },
    { label: t.nav.hardware, href: "/#hardware" },
    { label: t.nav.pricing, href: "/#precios" },
    { label: t.nav.faq, href: "/#faq" },
  ];
  return (
    <header className="sticky top-0 z-50 border-b border-forest/[0.07] bg-white/85 backdrop-blur-xl">
      <div className="mx-auto flex h-[76px] w-full max-w-[90rem] items-center justify-between px-6 lg:px-10">
        <a href="/" className="flex items-center" aria-label="Zertoo">
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
          <a
            href="https://zertooeats.com"
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm font-semibold text-graphite hover:opacity-70"
          >
            Zertoo <span className="text-[#8a9c00]">Eats!</span>
          </a>
          <a href="/#precios" className="text-sm font-semibold text-forest hover:opacity-70">{t.nav.viewPlans}</a>
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
              <a
                href="https://zertooeats.com"
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => setOpen(false)}
                className="py-3 text-base font-medium text-forest"
              >
                Zertoo <span className="text-[#8a9c00]">Eats!</span>
              </a>
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
