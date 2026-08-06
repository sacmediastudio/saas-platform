"use client";

import { useEffect, useRef, useState } from "react";
import { Star, Mail, Phone, MapPin, ChevronDown } from "lucide-react";
import { formatCurrency } from "@/lib/currency";

interface MenuItemData {
  id: string;
  categoryId: string;
  name: string;
  description: string | null;
  price: number;
  status: "AVAILABLE" | "SOLD_OUT" | "SEASONAL";
  featured: boolean;
  imageUrl: string | null;
}
interface CategoryData {
  id: string;
  name: string;
}
interface TenantData {
  name: string;
  slug: string;
  logoUrl: string | null;
  heroImageUrl: string | null;
  heroTagline: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  address: string | null;
  currency: string;
  themeBgColor: string;
  themeTextColor: string;
  buttonColor: string;
  buttonTextColor: string;
}

export default function PublicMenu({
  tenant,
  categories,
  items,
  avgRating,
  reviewCount,
}: {
  tenant: TenantData;
  categories: CategoryData[];
  items: MenuItemData[];
  avgRating: number | null;
  reviewCount: number;
}) {
  const categoriesWithItems = categories.filter((cat) => items.some((i) => i.categoryId === cat.id));
  const featuredItems = items.filter((i) => i.featured && i.status !== "SOLD_OUT").slice(0, 2);
  const [activeCategory, setActiveCategory] = useState<string | null>(categoriesWithItems[0]?.id ?? null);
  const sectionRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const navRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const id = entry.target.getAttribute("data-category-id");
            if (id) setActiveCategory(id);
          }
        });
      },
      { rootMargin: "-120px 0px -70% 0px", threshold: 0 }
    );

    Object.values(sectionRefs.current).forEach((el) => el && observer.observe(el));
    return () => observer.disconnect();
  }, [categoriesWithItems.length]);

  function scrollToCategory(id: string) {
    const el = sectionRefs.current[id];
    if (!el) return;
    const navHeight = navRef.current?.offsetHeight ?? 0;
    const top = el.getBoundingClientRect().top + window.scrollY - navHeight - 12;
    window.scrollTo({ top, behavior: "smooth" });
  }

  function scrollToMenu() {
    const firstId = categoriesWithItems[0]?.id;
    if (firstId) scrollToCategory(firstId);
  }

  const hasContact = tenant.contactEmail || tenant.contactPhone || tenant.address;

  return (
    <div
      className="min-h-screen"
      style={{ backgroundColor: tenant.themeBgColor, color: tenant.themeTextColor }}
    >
      {/* Hero */}
      <div className="relative h-[70vh] min-h-[420px] flex items-center justify-center text-center px-6">
        {tenant.heroImageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={tenant.heroImageUrl} alt="" className="absolute inset-0 w-full h-full object-cover" />
        ) : (
          <div className="absolute inset-0" style={{ backgroundColor: tenant.themeTextColor, opacity: 0.9 }} />
        )}
        <div className="absolute inset-0 bg-black/50" />

        <div className="relative z-10 max-w-md flex flex-col items-center">
          {tenant.logoUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={tenant.logoUrl}
              alt={tenant.name}
              className="w-16 h-16 rounded-2xl object-cover mb-4 border-2 border-white/30"
            />
          )}
          <p className="text-white text-3xl font-bold mb-2">{tenant.name}</p>
          <p className="text-white/70 text-xs tracking-[0.2em] uppercase mb-4">Menú</p>
          {tenant.heroTagline && (
            <p className="text-white/85 text-sm leading-relaxed mb-6">{tenant.heroTagline}</p>
          )}
          <button
            onClick={scrollToMenu}
            className="flex items-center gap-1.5 text-sm font-semibold px-6 py-3 rounded-full hover:brightness-105 transition-all"
            style={{ backgroundColor: tenant.buttonColor, color: tenant.buttonTextColor }}
          >
            Ver menú
            <ChevronDown size={16} aria-hidden />
          </button>
        </div>
      </div>

      {/* Destacados */}
      {featuredItems.length > 0 && (
        <div className="px-5 py-8 max-w-xl mx-auto">
          <h2 className="text-xs font-semibold tracking-[0.15em] uppercase opacity-60 mb-4">Destacados</h2>
          <div className="flex flex-col gap-5">
            {featuredItems.map((item) => (
              <div
                key={item.id}
                className="rounded-2xl overflow-hidden border"
                style={{ borderColor: "currentColor", opacity: 1 }}
              >
                <div className="relative w-full aspect-[4/3] bg-black/10">
                  {item.imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={item.imageUrl} alt={item.name} className="w-full h-full object-cover" />
                  ) : (
                    <div
                      className="w-full h-full flex items-center justify-center text-4xl font-bold opacity-20"
                      style={{ backgroundColor: "currentColor" }}
                    >
                      <span style={{ color: tenant.themeBgColor }}>{item.name.charAt(0)}</span>
                    </div>
                  )}
                  <span className="absolute top-3 left-3 flex items-center gap-1 bg-black/75 text-white text-xs font-semibold px-3 py-1.5 rounded-full">
                    <Star size={12} className="fill-white" aria-hidden />
                    Destacado
                  </span>
                </div>
                <div className="px-5 py-4" style={{ backgroundColor: tenant.themeBgColor }}>
                  <div className="flex items-start justify-between gap-3">
                    <p className="text-xl font-bold leading-tight">{item.name}</p>
                    <span className="text-xl font-bold text-red-600 shrink-0">
                      {formatCurrency(item.price, tenant.currency)}
                    </span>
                  </div>
                  {item.description && (
                    <p className="text-sm opacity-60 mt-2">{item.description}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Nav de categorías, pegajosa */}
      <div
        ref={navRef}
        className="sticky top-0 z-20 backdrop-blur border-b"
        style={{ backgroundColor: tenant.themeBgColor + "e6", borderColor: "currentColor" }}
      >
        <div className="max-w-xl mx-auto px-5 py-3 flex items-center gap-2 overflow-x-auto no-scrollbar">
          {tenant.logoUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={tenant.logoUrl} alt="" className="w-6 h-6 rounded-md object-cover shrink-0 mr-1" />
          )}
          {categoriesWithItems.map((cat) => (
            <button
              key={cat.id}
              onClick={() => scrollToCategory(cat.id)}
              className="text-sm font-medium px-3 py-1.5 rounded-full whitespace-nowrap shrink-0 transition-opacity"
              style={{
                backgroundColor: activeCategory === cat.id ? tenant.buttonColor : "transparent",
                opacity: activeCategory === cat.id ? 1 : 0.6,
              }}
            >
              <span
                style={{
                  color: activeCategory === cat.id ? tenant.buttonTextColor : tenant.themeTextColor,
                }}
              >
                {cat.name}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Lista de platos por categoría, sin fotos */}
      <div className="max-w-xl mx-auto px-5">
        {categoriesWithItems.map((cat) => {
          const catItems = items.filter((i) => i.categoryId === cat.id);
          return (
            <div
              key={cat.id}
              ref={(el) => {
                sectionRefs.current[cat.id] = el;
              }}
              data-category-id={cat.id}
              className="py-8 border-b"
              style={{ borderColor: "currentColor", opacity: 1 }}
            >
              <h2 className="text-xl font-bold mb-5">{cat.name}</h2>
              <div className="flex flex-col divide-y" style={{ borderColor: "currentColor" }}>
                {catItems.map((item) => (
                  <div key={item.id} className={`py-4 first:pt-0 ${item.status === "SOLD_OUT" ? "opacity-45" : ""}`}>
                    <div className="flex items-baseline justify-between gap-3">
                      <p className="text-base font-semibold">{item.name}</p>
                      {item.status === "SOLD_OUT" ? (
                        <span className="text-xs px-2 py-0.5 rounded-md bg-red-50 text-red-700 shrink-0">
                          Agotado
                        </span>
                      ) : (
                        <span className="text-base font-semibold shrink-0">
                          {formatCurrency(item.price, tenant.currency)}
                        </span>
                      )}
                    </div>
                    {item.description && (
                      <p className="text-sm opacity-60 mt-1">{item.description}</p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          );
        })}

        {categoriesWithItems.length === 0 && (
          <p className="py-10 text-sm opacity-60">Este menú todavía no tiene platos.</p>
        )}

        <div className="py-6">
          {avgRating && (
            <p className="flex items-center gap-1 text-sm opacity-70 mb-4">
              <Star size={13} className="fill-amber-400 text-amber-400" aria-hidden />
              {avgRating.toFixed(1)} · {reviewCount} reseñas
            </p>
          )}
          <a
            href={`/review/${tenant.slug}`}
            className="flex items-center justify-center gap-1.5 w-full py-2.5 text-sm font-semibold rounded-full hover:brightness-105 transition-all"
            style={{ backgroundColor: tenant.buttonColor, color: tenant.buttonTextColor }}
          >
            <Star size={14} aria-hidden />
            Dejar una reseña
          </a>
        </div>

        {hasContact && (
          <div className="pb-10 pt-4 border-t text-xs opacity-60 flex flex-col gap-1.5" style={{ borderColor: "currentColor" }}>
            {tenant.address && (
              <span className="flex items-center gap-1.5">
                <MapPin size={13} aria-hidden /> {tenant.address}
              </span>
            )}
            {tenant.contactPhone && (
              <span className="flex items-center gap-1.5">
                <Phone size={13} aria-hidden /> {tenant.contactPhone}
              </span>
            )}
            {tenant.contactEmail && (
              <span className="flex items-center gap-1.5">
                <Mail size={13} aria-hidden /> {tenant.contactEmail}
              </span>
            )}
          </div>
        )}
      </div>

      {tenant.contactPhone && (
        <a
          href={`tel:${tenant.contactPhone.replace(/\s+/g, "")}`}
          className="fixed bottom-5 right-5 z-30 flex items-center gap-2 text-sm font-semibold px-4 py-3 rounded-full shadow-lg hover:brightness-105 transition-all"
          style={{ backgroundColor: tenant.buttonColor, color: tenant.buttonTextColor }}
        >
          <Phone size={15} aria-hidden />
          Llamar
        </a>
      )}
    </div>
  );
}
