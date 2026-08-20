import { notFound } from "next/navigation";
import type { Metadata } from "next";
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
import { db } from "@/lib/db";
import { recordPageView } from "@/lib/analytics";
import { getEnabledModules } from "@/lib/modules";
import { jsonLdScriptProps } from "@/lib/json-ld";
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

export async function generateMetadata({ params }: { params: { slug: string } }): Promise<Metadata> {
  const tenant = await db.tenant.findUnique({
    where: { slug: params.slug },
    select: { name: true, heroTagline: true, heroImageUrl: true, logoUrl: true },
  });
  if (!tenant) return { title: "Zertoo" };

  const title = `${tenant.name} | Todos mis links`;
  const description = tenant.heroTagline || `Todos los links y redes de ${tenant.name}, en un solo lugar.`;
  const image = tenant.heroImageUrl || tenant.logoUrl || undefined;

  return {
    title,
    description,
    openGraph: { title, description, type: "profile", images: image ? [{ url: image }] : undefined },
    twitter: { card: "summary_large_image", title, description, images: image ? [image] : undefined },
  };
}

export default async function PublicSmartLinkPage({ params }: { params: { slug: string } }) {
  const tenant = await db.tenant.findUnique({ where: { slug: params.slug } });
  if (!tenant || tenant.suspended || !getEnabledModules(tenant).includes("SMARTLINK")) notFound();

  await recordPageView(tenant.id, "LINK");

  const items = await db.smartLinkItem.findMany({
    where: { tenantId: tenant.id },
    orderBy: { sortOrder: "asc" },
  });

  const hasBgImage = Boolean(tenant.heroImageUrl);

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: tenant.name,
    ...(tenant.logoUrl ? { logo: tenant.logoUrl } : {}),
    ...(tenant.contactPhone ? { telephone: tenant.contactPhone } : {}),
  };

  return (
    <div className="relative min-h-screen" style={{ backgroundColor: tenant.themeBgColor }}>
      <script type="application/ld+json" dangerouslySetInnerHTML={jsonLdScriptProps(jsonLd)} />
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

        <p className={`text-2xl font-bold text-center ${tenant.heroTagline ? "mb-1" : "mb-8"}`}>
          {tenant.name}
        </p>
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

          {items.length === 0 && (
            <p className="text-sm text-center opacity-70">Este perfil todavía no tiene links.</p>
          )}
        </div>

        <a
          href={`/review/${tenant.slug}`}
          className="text-sm font-medium underline pt-8"
          style={{ opacity: 0.7 }}
        >
          Dejar una reseña
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
