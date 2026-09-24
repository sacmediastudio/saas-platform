import type { translations } from "@/lib/i18n-landing";

const LOGO = "/logo.svg";

export default function Footer({ t }: { t: (typeof translations)["en"] }) {
  return (
    <footer className="border-t border-forest/[0.07] bg-white">
      <div className="mx-auto flex w-full max-w-[90rem] flex-col gap-10 px-6 py-14 lg:flex-row lg:items-center lg:justify-between lg:px-10">
        <div>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={LOGO} alt="Zertoo" className="h-6 w-auto" />
          <p className="mt-4 max-w-[34ch] text-sm text-graphite/70">{t.footer.tagline}</p>
        </div>
        <nav className="flex flex-wrap gap-x-8 gap-y-3 text-sm font-medium text-graphite">
          <a href="mailto:hello@zertoo.app" className="transition-colors hover:text-forest">{t.footer.contact}</a>
          <a href="/#productos" className="transition-colors hover:text-forest">{t.footer.products}</a>
          <a href="/#precios" className="transition-colors hover:text-forest">{t.footer.pricing}</a>
          <a href="/#faq" className="transition-colors hover:text-forest">{t.footer.faq}</a>
          <a href="/privacidad" className="transition-colors hover:text-forest">{t.footer.privacy}</a>
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
