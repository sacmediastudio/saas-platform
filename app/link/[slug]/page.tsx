import { notFound } from "next/navigation";
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
} from "lucide-react";
import { db } from "@/lib/db";

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
  CUSTOM: Link2,
};

function hrefFor(type: string, value: string): string {
  if (type === "WHATSAPP") {
    const digits = value.replace(/\D/g, "");
    return `https://wa.me/${digits}`;
  }
  if (type === "PHONE") {
    return `tel:${value.replace(/\s+/g, "")}`;
  }
  return value;
}

export default async function PublicSmartLinkPage({ params }: { params: { slug: string } }) {
  const tenant = await db.tenant.findUnique({ where: { slug: params.slug } });
  if (!tenant || tenant.businessType !== "SMARTLINK") notFound();

  const items = await db.smartLinkItem.findMany({
    where: { tenantId: tenant.id },
    orderBy: { sortOrder: "asc" },
  });

  const hasBgImage = Boolean(tenant.heroImageUrl);

  return (
    <div className="relative min-h-screen" style={{ backgroundColor: tenant.themeBgColor }}>
      {hasBgImage && (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={tenant.heroImageUrl!}
            alt=""
            className="absolute inset-0 w-full h-full object-cover"
          />
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
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={tenant.logoUrl}
            alt={tenant.name}
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

        <p className="text-lg font-semibold text-center mb-8">{tenant.name}</p>

        <div className="w-full flex flex-col gap-3">
          {items.map((item) => {
            const Icon = ICONS[item.type] ?? Link2;
            return (
              <a
                key={item.id}
                href={hrefFor(item.type, item.value)}
                target={item.type === "PHONE" ? undefined : "_blank"}
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
      </div>
    </div>
  );
}
