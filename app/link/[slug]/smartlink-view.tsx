"use client";

import { useEffect, useState } from "react";
import {
  Globe,
  MessageCircle,
  Phone,
  Instagram,
  Facebook,
  Youtube,
  Linkedin,
  MapPin,
  Link2,
  Contact,
} from "lucide-react";
import { getStoredLang, setStoredLang, type Lang } from "@/lib/i18n-auth";
import { publicTranslations } from "@/lib/i18n-public";
import FaqChatWidget from "@/components/faq-chat-widget";
import SmartImage from "@/components/smart-image";

const ICONS: Record<string, any> = {
  WEBSITE: Globe,
  WHATSAPP: MessageCircle,
  PHONE: Phone,
  INSTAGRAM: Instagram,
  FACEBOOK: Facebook,
  TIKTOK: Link2,
  TWITTER: Link2,
  YOUTUBE: Youtube,
  LINKEDIN: Linkedin,
  MAPS: MapPin,
  VCARD: Contact,
  CUSTOM: Link2,
};

interface TenantData {
  name: string;
  slug: string;
  logoUrl: string | null;
  heroImageUrl: string | null;
  heroTagline: string | null;
  themeBgColor: string;
  themeTextColor: string;
  buttonColor: string;
  buttonTextColor: string;
  contactPhone: string | null;
}
interface SmartLinkItemData {
  id: string;
  type: string;
  label: string;
}

export default function SmartLinkView({ tenant, items }: { tenant: TenantData; items: SmartLinkItemData[] }) {
  const [lang, setLang] = useState<Lang>("es");
  useEffect(() => {
    setLang(getStoredLang());
  }, []);
  function toggleLang(l: Lang) {
    setLang(l);
    setStoredLang(l);
  }
  const t = publicTranslations[lang].smartlink;

  const hasBgImage = Boolean(tenant.heroImageUrl);

  return (
    <div className="relative min-h-screen" style={{ backgroundColor: tenant.themeBgColor }}>
      {hasBgImage && (
        <>
          <SmartImage src={tenant.heroImageUrl} alt="" fill priority className="object-cover" sizes="100vw" />
          {/* Overlay oscuro para que el texto siga siendo legible sobre
              cualquier foto de fondo, sin importar qué tan clara sea. */}
          <div className="absolute inset-0 bg-black/45" />
        </>
      )}

      <div
        className="relative z-10 max-w-sm mx-auto min-h-screen px-6 pt-14 pb-10 flex flex-col items-center"
        style={{ color: hasBgImage ? "#ffffff" : tenant.themeTextColor }}
      >
        <div
          className="absolute top-4 right-4 flex items-center rounded-full border px-0.5 py-0.5 text-[11px] font-bold"
          style={{ borderColor: "currentColor", opacity: 0.85 }}
        >
          {(["es", "en"] as const).map((l) => (
            <button
              key={l}
              type="button"
              onClick={() => toggleLang(l)}
              className="px-2 py-0.5 rounded-full transition-colors"
              style={lang === l ? { backgroundColor: "currentColor", color: tenant.themeBgColor } : undefined}
            >
              {l.toUpperCase()}
            </button>
          ))}
        </div>

        {tenant.logoUrl ? (
          <SmartImage
            src={tenant.logoUrl}
            alt={tenant.name}
            width={96}
            height={96}
            className="w-24 h-24 rounded-full object-cover mb-4 border-2 border-white/40"
          />
        ) : (
          <div
            className="w-24 h-24 rounded-full mb-4 flex items-center justify-center text-2xl font-semibold"
            style={{
              backgroundColor: hasBgImage ? "rgba(255,255,255,0.15)" : tenant.themeTextColor,
              color: hasBgImage ? "#ffffff" : tenant.themeBgColor,
            }}
          >
            {tenant.name.charAt(0).toUpperCase()}
          </div>
        )}

        <p className={`text-2xl font-bold text-center ${tenant.heroTagline ? "mb-1" : "mb-8"}`}>{tenant.name}</p>
        {tenant.heroTagline && (
          <p
            className="text-sm text-center mb-8 max-w-[280px] leading-relaxed"
            style={{ opacity: hasBgImage ? 0.85 : 0.65 }}
          >
            {tenant.heroTagline}
          </p>
        )}

        <div className="w-full flex flex-col gap-3">
          {items.map((item) => {
            const Icon = ICONS[item.type] ?? Link2;
            return (
              <a
                key={item.id}
                href={`/api/smartlink-items/${item.id}/go`}
                target={item.type === "PHONE" || item.type === "VCARD" ? undefined : "_blank"}
                rel="noopener noreferrer"
                className="flex items-center gap-3 w-full px-4 py-3.5 rounded-xl font-medium hover:brightness-105 transition-all"
                style={{ backgroundColor: tenant.buttonColor, color: tenant.buttonTextColor }}
              >
                <Icon size={18} aria-hidden />
                <span className="text-sm">{item.label}</span>
              </a>
            );
          })}

          {items.length === 0 && <p className="text-sm text-center opacity-70">{t.noLinks}</p>}
        </div>

        <a href={`/review/${tenant.slug}`} className="text-sm font-medium underline pt-8" style={{ opacity: 0.7 }}>
          {t.leaveReview}
        </a>

        <div className="pt-6 pb-2 opacity-50">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/logo.svg"
            alt="Zertoo"
            className="h-4 w-auto"
            style={hasBgImage ? { filter: "brightness(0) invert(1)" } : undefined}
          />
        </div>
      </div>

      <FaqChatWidget
        tenantSlug={tenant.slug}
        buttonColor={tenant.buttonColor}
        buttonTextColor={tenant.buttonTextColor}
        themeBgColor={tenant.themeBgColor}
        themeTextColor={tenant.themeTextColor}
      />
    </div>
  );
}
