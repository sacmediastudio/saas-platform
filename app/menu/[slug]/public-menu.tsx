"use client";

import { useEffect, useRef, useState } from "react";
import { Star, Mail, Phone, MapPin, ChevronDown, ChevronLeft, ChevronRight, X, Heart, ArrowRight } from "lucide-react";
import { formatCurrency } from "@/lib/currency";
import { setStoredLang, type Lang } from "@/lib/i18n-auth";
import FaqChatWidget from "@/components/faq-chat-widget";
import SmartImage from "@/components/smart-image";

interface MenuItemAddOnData {
  id: string;
  name: string;
  price: number;
}
interface CartLine {
  lineId: string;
  menuItemId: string;
  quantity: number;
  addOnIds: string[];
  notes: string;
}
interface MenuItemData {
  id: string;
  categoryId: string;
  name: string;
  description: string | null;
  descriptionEn: string | null;
  price: number;
  variablePrice: boolean;
  status: "AVAILABLE" | "SOLD_OUT" | "SEASONAL";
  featured: boolean;
  imageUrl: string | null;
  addOns: MenuItemAddOnData[];
}
interface CategoryData {
  id: string;
  name: string;
  nameEn: string | null;
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
  secondaryCurrencyCode: string | null;
  secondaryCurrencyRate: number | null;
  themeBgColor: string;
  themeTextColor: string;
  buttonColor: string;
  buttonTextColor: string;
  menuCardColor: string;
  menuPageTextColor: string;
  menuShowPhotos: boolean;
  menuLeadEnabled: boolean;
  menuLeadButtonLabel: string;
  orderingEnabled: boolean;
  pickupEnabled: boolean;
  deliveryEnabled: boolean;
  deliveryFee: number | null;
  minDeliveryAmount: number | null;
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
  // El nombre de cada plato NUNCA se traduce (puede ser cualquier cosa —
  // una marca, un plato regional, etc.). Solo las categorías y las
  // descripciones tienen una versión en inglés opcional, escrita a mano
  // por el negocio en su dashboard — no hay traducción automática.
  //
  // Nota: acá NO usamos getStoredLang() (que por defecto cae a "en",
  // pensado para la landing). En el menú es más intuitivo arrancar en
  // español salvo que la persona ya haya elegido inglés explícitamente
  // en algún momento — si no, alguien que entra directo al menú sin
  // pasar por la landing vería "EN" activo sin haberlo pedido.
  const [lang, setLang] = useState<Lang>("es");
  useEffect(() => {
    if (typeof window === "undefined") return;
    const stored = window.localStorage.getItem("zertoo_lang");
    setLang(stored === "en" ? "en" : "es");
  }, []);

  function favLabel(isFav: boolean): string {
    if (isFav) return lang === "en" ? "Remove from favorites" : "Quitar de favoritos";
    return lang === "en" ? "Add to favorites" : "Agregar a favoritos";
  }

  function categoryLabel(cat: CategoryData) {
    return lang === "en" && cat.nameEn ? cat.nameEn : cat.name;
  }
  function itemDescription(item: MenuItemData) {
    return lang === "en" && item.descriptionEn ? item.descriptionEn : item.description;
  }

  function priceLabel(item: MenuItemData) {
    if (item.variablePrice) return lang === "en" ? "Ask" : "Preguntar";
    const primary = formatCurrency(item.price, tenant.currency);
    if (!tenant.secondaryCurrencyCode || !tenant.secondaryCurrencyRate) return primary;
    const secondary = formatCurrency(item.price * tenant.secondaryCurrencyRate, tenant.secondaryCurrencyCode);
    return (
      <>
        <span className="font-bold">{primary}</span>{" "}
        <span className="font-normal opacity-70">/ {secondary}</span>
      </>
    );
  }

  // Wishlist del cliente: solo vive en su navegador (no requiere cuenta
  // ni login), separada por negocio, para que marcar favoritos en un
  // restaurante no se mezcle con los de otro.
  const wishlistKey = `zertoo_wishlist_${tenant.slug}`;
  const [wishlist, setWishlist] = useState<string[]>([]);
  const [showWishlistOnly, setShowWishlistOnly] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const stored = window.localStorage.getItem(wishlistKey);
      if (stored) setWishlist(JSON.parse(stored));
    } catch {
      // localStorage corrupto o bloqueado — no es crítico, sigue en 0
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function toggleWishlist(itemId: string) {
    setWishlist((prev) => {
      const next = prev.includes(itemId) ? prev.filter((id) => id !== itemId) : [...prev, itemId];
      try {
        window.localStorage.setItem(wishlistKey, JSON.stringify(next));
      } catch {
        // no crítico
      }
      return next;
    });
  }

  const visibleItems = showWishlistOnly ? items.filter((i) => wishlist.includes(i.id)) : items;
  const categoriesWithItems = categories.filter((cat) => visibleItems.some((i) => i.categoryId === cat.id));
  const featuredItems = visibleItems.filter((i) => i.featured && i.status !== "SOLD_OUT").slice(0, 2);
  const [activeCategory, setActiveCategory] = useState<string | null>(categoriesWithItems[0]?.id ?? null);
  const [zoomedItem, setZoomedItem] = useState<MenuItemData | null>(null);
  const [leadModalOpen, setLeadModalOpen] = useState(false);
  // Cada línea del carrito es su propia configuración — así el mismo
  // plato puede estar dos veces en el carrito con add-ons distintos
  // (ej. una hamburguesa con papas, otra sin nada).
  const [cartLines, setCartLines] = useState<CartLine[]>([]);
  const [customizeItem, setCustomizeItem] = useState<MenuItemData | null>(null);
  const [checkoutOpen, setCheckoutOpen] = useState(false);

  const allItems = items;

  function lineTotal(line: CartLine): number {
    const item = allItems.find((i) => i.id === line.menuItemId);
    if (!item) return 0;
    const addOnsTotal = line.addOnIds.reduce((sum, id) => {
      const addOn = item.addOns.find((a) => a.id === id);
      return sum + (addOn?.price ?? 0);
    }, 0);
    return (item.price + addOnsTotal) * line.quantity;
  }

  const cartCount = cartLines.reduce((sum, l) => sum + l.quantity, 0);
  const cartSubtotal = cartLines.reduce((sum, l) => sum + lineTotal(l), 0);

  // Para platos SIN add-ons, "+"/"-" es un ajuste rápido de cantidad,
  // sin abrir ningún modal — mismo comportamiento simple que ya había.
  function quickAdd(itemId: string) {
    setCartLines((prev) => {
      const existing = prev.find((l) => l.menuItemId === itemId && l.addOnIds.length === 0 && !l.notes);
      if (existing) {
        return prev.map((l) => (l.lineId === existing.lineId ? { ...l, quantity: l.quantity + 1 } : l));
      }
      return [...prev, { lineId: crypto.randomUUID(), menuItemId: itemId, quantity: 1, addOnIds: [], notes: "" }];
    });
  }
  function quickRemove(itemId: string) {
    setCartLines((prev) => {
      const existing = prev.find((l) => l.menuItemId === itemId && l.addOnIds.length === 0 && !l.notes);
      if (!existing) return prev;
      if (existing.quantity <= 1) return prev.filter((l) => l.lineId !== existing.lineId);
      return prev.map((l) => (l.lineId === existing.lineId ? { ...l, quantity: l.quantity - 1 } : l));
    });
  }
  function quickQuantityFor(itemId: string): number {
    return cartLines.find((l) => l.menuItemId === itemId && l.addOnIds.length === 0 && !l.notes)?.quantity ?? 0;
  }
  function addCustomizedLine(line: Omit<CartLine, "lineId">) {
    setCartLines((prev) => [...prev, { ...line, lineId: crypto.randomUUID() }]);
  }
  function removeLine(lineId: string) {
    setCartLines((prev) => prev.filter((l) => l.lineId !== lineId));
  }

  const sectionRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const navRef = useRef<HTMLDivElement | null>(null);
  const categoryScrollRef = useRef<HTMLDivElement | null>(null);
  const [showLeftArrow, setShowLeftArrow] = useState(false);
  const [showRightArrow, setShowRightArrow] = useState(false);

  // Con el scrollbar escondido (por estética), en computadora no había
  // ninguna pista de que hubiera más categorías para el lado — estas
  // flechas son la forma confiable de llegar a ellas sin depender de
  // que alguien sepa "arrastrar" con el mouse.
  function updateCategoryArrows() {
    const el = categoryScrollRef.current;
    if (!el) return;
    setShowLeftArrow(el.scrollLeft > 4);
    setShowRightArrow(el.scrollLeft < el.scrollWidth - el.clientWidth - 4);
  }

  useEffect(() => {
    updateCategoryArrows();
    const el = categoryScrollRef.current;
    if (!el) return;
    el.addEventListener("scroll", updateCategoryArrows);
    window.addEventListener("resize", updateCategoryArrows);
    return () => {
      el.removeEventListener("scroll", updateCategoryArrows);
      window.removeEventListener("resize", updateCategoryArrows);
    };
  }, [categoriesWithItems.length]);

  function scrollCategoryNav(direction: "left" | "right") {
    categoryScrollRef.current?.scrollBy({ left: direction === "left" ? -160 : 160, behavior: "smooth" });
  }

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
          <SmartImage src={tenant.heroImageUrl} alt="" fill priority className="object-cover" sizes="100vw" />
        ) : (
          <div className="absolute inset-0" style={{ backgroundColor: tenant.themeTextColor, opacity: 0.9 }} />
        )}
        <div className="absolute inset-0 bg-black/50" />

        <div className="relative z-10 max-w-md flex flex-col items-center">
          {tenant.logoUrl && (
            <SmartImage
              src={tenant.logoUrl}
              alt={tenant.name}
              width={64}
              height={64}
              className="w-16 h-16 rounded-2xl object-cover mb-4 border-2 border-white/30"
            />
          )}
          <p className="text-white text-4xl font-bold mb-2">{tenant.name}</p>
          <p className="text-white/70 text-xs tracking-[0.2em] uppercase mb-4">Menú</p>
          {tenant.heroTagline && (
            <p className="text-white/85 text-sm leading-relaxed mb-6">{tenant.heroTagline}</p>
          )}
          <button
            onClick={scrollToMenu}
            className="flex items-center gap-1.5 text-sm font-semibold px-6 py-3 rounded-full hover:brightness-105 transition-all"
            style={{ backgroundColor: tenant.buttonColor, color: tenant.buttonTextColor }}
          >
            {lang === "en" ? "View menu" : "Ver menú"}
            <ChevronDown size={16} aria-hidden />
          </button>
        </div>
      </div>

      {/* Nav de categorías, pegajosa */}
      <div
        ref={navRef}
        className="sticky top-0 z-20 backdrop-blur"
        style={{ backgroundColor: tenant.themeBgColor + "e6" }}
      >
        <div className="max-w-xl mx-auto px-5 py-3 flex flex-col gap-2">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              {tenant.logoUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={tenant.logoUrl} alt="" className="w-7 h-7 rounded-md object-cover shrink-0" />
              )}
              <span
                className="text-sm font-semibold truncate"
                style={{ color: tenant.menuPageTextColor }}
              >
                {tenant.name}
              </span>
            </div>
            <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => setShowWishlistOnly((v) => !v)}
              aria-label={lang === "en" ? "See favorites" : "Ver favoritos"}
              className="flex items-center gap-1 text-xs font-bold px-2.5 py-1.5 rounded-full transition-colors"
              style={{
                backgroundColor: showWishlistOnly ? tenant.buttonColor : "transparent",
                color: showWishlistOnly ? tenant.buttonTextColor : tenant.themeTextColor,
                border: showWishlistOnly ? "none" : "1px solid color-mix(in srgb, currentColor 20%, transparent)",
              }}
            >
              <Heart size={13} className={wishlist.length > 0 ? "fill-current" : ""} aria-hidden />
              {wishlist.length}
            </button>
            <div
              className="flex items-center rounded-full p-0.5 text-xs font-bold"
              style={{ border: "1px solid color-mix(in srgb, currentColor 20%, transparent)" }}
            >
              {(["ES", "EN"] as const).map((l) => {
                const value = l.toLowerCase() as Lang;
                const active = lang === value;
                return (
                  <button
                    key={l}
                    type="button"
                    onClick={() => {
                      setLang(value);
                      setStoredLang(value);
                    }}
                    className="px-2 py-1 rounded-full transition-colors"
                    style={{
                      backgroundColor: active ? tenant.buttonColor : "transparent",
                      color: active ? tenant.buttonTextColor : tenant.themeTextColor,
                      opacity: active ? 1 : 0.6,
                    }}
                  >
                    {l}
                  </button>
                );
              })}
            </div>
          </div>
          </div>

          <div className="relative flex-1 min-w-0 flex items-center">
            {showLeftArrow && (
              <button
                onClick={() => scrollCategoryNav("left")}
                aria-label={lang === "en" ? "See previous categories" : "Ver categorías anteriores"}
                className="absolute left-0 z-10 w-7 h-7 rounded-full flex items-center justify-center shrink-0"
                style={{ backgroundColor: tenant.themeBgColor, color: tenant.menuPageTextColor, boxShadow: "0 0 8px 4px " + tenant.themeBgColor }}
              >
                <ChevronLeft size={16} aria-hidden />
              </button>
            )}
            <div ref={categoryScrollRef} className="flex items-center gap-2 overflow-x-auto no-scrollbar scroll-smooth">
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
                      color: activeCategory === cat.id ? tenant.buttonTextColor : tenant.menuPageTextColor,
                    }}
                  >
                    {categoryLabel(cat)}
                  </span>
                </button>
              ))}
            </div>
            {showRightArrow && (
              <button
                onClick={() => scrollCategoryNav("right")}
                aria-label={lang === "en" ? "See more categories" : "Ver más categorías"}
                className="absolute right-0 z-10 w-7 h-7 rounded-full flex items-center justify-center shrink-0"
                style={{ backgroundColor: tenant.themeBgColor, color: tenant.menuPageTextColor, boxShadow: "0 0 8px 4px " + tenant.themeBgColor }}
              >
                <ChevronRight size={16} aria-hidden />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Destacados */}
      {featuredItems.length > 0 && (
        <div className="px-5 py-8 max-w-xl mx-auto">
          <h2
            className="text-xs font-semibold tracking-[0.15em] uppercase opacity-60 mb-4"
            style={{ color: tenant.menuPageTextColor }}
          >
            {lang === "en" ? "Featured" : "Destacados"}
          </h2>
          <div className="flex flex-col gap-5">
            {featuredItems.map((item) => (
              <div
                key={item.id}
                className="rounded-2xl overflow-hidden border shadow-[0_4px_20px_-8px_rgba(0,0,0,0.12)]"
                style={{ borderColor: "color-mix(in srgb, currentColor 12%, transparent)" }}
              >
                <div
                  className={`relative w-full aspect-[4/3] bg-black/10 ${item.imageUrl ? "cursor-pointer active:opacity-80 transition-opacity" : ""}`}
                  onClick={item.imageUrl ? () => setZoomedItem(item) : undefined}
                >
                  {item.imageUrl ? (
                    <SmartImage
                      src={item.imageUrl}
                      alt={item.name}
                      fill
                      className="object-cover"
                      sizes="(min-width: 576px) 576px, 100vw"
                    />
                  ) : (
                    <div
                      className="w-full h-full flex items-center justify-center text-4xl font-bold opacity-20"
                      style={{ backgroundColor: "currentColor" }}
                    >
                      <span style={{ color: tenant.themeBgColor }}>{item.name.charAt(0)}</span>
                    </div>
                  )}
                  <span className="absolute top-3 left-3 flex items-center gap-1 bg-orange-500 text-white text-xs font-semibold px-3 py-1.5 rounded-full">
                    <Star size={12} className="fill-white" aria-hidden />
                    {lang === "en" ? "Featured" : "Destacado"}
                  </span>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleWishlist(item.id);
                    }}
                    aria-label={favLabel(wishlist.includes(item.id))}
                    className="absolute top-3 right-3 bg-black/50 hover:bg-black/65 rounded-full p-2 transition-colors"
                  >
                    <Heart
                      size={16}
                      className={wishlist.includes(item.id) ? "fill-red-500 text-red-500" : "text-white"}
                      aria-hidden
                    />
                  </button>
                </div>
                <div className="px-5 py-4" style={{ backgroundColor: tenant.menuCardColor }}>
                  <div className="flex items-start justify-between gap-3">
                    <p className="text-xl font-bold leading-tight">{item.name}</p>
                    <span className="text-xl font-bold text-red-600 shrink-0">
                      {priceLabel(item)}
                    </span>
                  </div>
                  {itemDescription(item) && (
                    <p className="text-sm opacity-60 mt-2">{itemDescription(item)}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Lista de platos por categoría — con o sin foto, según lo que
          el negocio haya elegido en Ajustes (menuShowPhotos). */}
      <div className="max-w-xl mx-auto px-5">
        {categoriesWithItems.map((cat) => {
          const catItems = visibleItems.filter((i) => i.categoryId === cat.id);
          return (
            <div
              key={cat.id}
              ref={(el) => {
                sectionRefs.current[cat.id] = el;
              }}
              data-category-id={cat.id}
              className="rounded-2xl px-5 py-6 mb-6 shadow-[0_4px_20px_-8px_rgba(0,0,0,0.12)]"
              style={{ backgroundColor: tenant.menuCardColor }}
            >
              <h2 className="text-xl font-bold mb-5">{categoryLabel(cat)}</h2>
              <div
                className="flex flex-col divide-y"
                style={{ borderColor: "color-mix(in srgb, currentColor 8%, transparent)" }}
              >
                {catItems.map((item) => {
                  const hasPhoto = tenant.menuShowPhotos && Boolean(item.imageUrl);
                  const liked = wishlist.includes(item.id);
                  return (
                    <div
                      key={item.id}
                      className={`py-4 first:pt-0 flex items-center gap-3 ${item.status === "SOLD_OUT" ? "opacity-45" : ""}`}
                    >
                      {!hasPhoto && (
                        <button
                          onClick={() => toggleWishlist(item.id)}
                          aria-label={favLabel(liked)}
                          className="shrink-0 p-1 -ml-1"
                        >
                          <Heart
                            size={18}
                            className={liked ? "fill-red-500 text-red-500" : ""}
                            style={liked ? undefined : { opacity: 0.35 }}
                            aria-hidden
                          />
                        </button>
                      )}
                      <div
                        onClick={hasPhoto ? () => setZoomedItem(item) : undefined}
                        className={`flex-1 min-w-0 flex gap-3 ${
                          hasPhoto ? "cursor-pointer active:opacity-70 transition-opacity" : ""
                        }`}
                      >
                        {hasPhoto && (
                          <div className="relative shrink-0">
                            <SmartImage
                              src={item.imageUrl}
                              alt={item.name}
                              width={56}
                              height={56}
                              className="w-14 h-14 rounded-lg object-cover"
                            />
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                toggleWishlist(item.id);
                              }}
                              aria-label={favLabel(liked)}
                              className="absolute top-0.5 right-0.5 p-1 rounded-full"
                              style={{ backgroundColor: "rgba(0,0,0,0.35)" }}
                            >
                              <Heart
                                size={13}
                                className={liked ? "fill-red-500 text-red-500" : "text-white"}
                                aria-hidden
                              />
                            </button>
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-baseline justify-between gap-3">
                            <p className="text-base font-semibold">{item.name}</p>
                            {item.status === "SOLD_OUT" ? (
                              <span className="text-xs px-2 py-0.5 rounded-md bg-red-50 text-red-700 shrink-0">
                                {lang === "en" ? "Sold out" : "Agotado"}
                              </span>
                            ) : (
                              <span className="text-base font-semibold shrink-0">
                                {priceLabel(item)}
                              </span>
                            )}
                          </div>
                          {itemDescription(item) && (
                            <p className="text-sm opacity-60 mt-1">{itemDescription(item)}</p>
                          )}
                        </div>
                      </div>
                      {tenant.orderingEnabled && item.status !== "SOLD_OUT" && !item.variablePrice && (
                        <div className="flex items-center gap-2 shrink-0">
                          {item.addOns.length > 0 ? (
                            <button
                              onClick={() => setCustomizeItem(item)}
                              aria-label={lang === "en" ? "Customize and add to order" : "Personalizar y agregar al pedido"}
                              className="w-6 h-6 rounded-full flex items-center justify-center text-sm font-bold"
                              style={{ backgroundColor: tenant.buttonColor, color: tenant.buttonTextColor }}
                            >
                              +
                            </button>
                          ) : (
                            <>
                              {quickQuantityFor(item.id) > 0 && (
                                <>
                                  <button
                                    onClick={() => quickRemove(item.id)}
                                    aria-label={lang === "en" ? "Remove one" : "Quitar uno"}
                                    className="w-6 h-6 rounded-full border flex items-center justify-center text-sm"
                                    style={{ borderColor: "currentColor" }}
                                  >
                                    −
                                  </button>
                                  <span className="text-sm font-semibold w-4 text-center">
                                    {quickQuantityFor(item.id)}
                                  </span>
                                </>
                              )}
                              <button
                                onClick={() => quickAdd(item.id)}
                                aria-label={lang === "en" ? "Add to order" : "Agregar al pedido"}
                                className="w-6 h-6 rounded-full flex items-center justify-center text-sm font-bold"
                                style={{ backgroundColor: tenant.buttonColor, color: tenant.buttonTextColor }}
                              >
                                +
                              </button>
                            </>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}

        {categoriesWithItems.length === 0 && showWishlistOnly && (
          <p className="py-10 text-sm opacity-60 text-center">Todavía no marcaste ningún plato como favorito.</p>
        )}
        {categoriesWithItems.length === 0 && !showWishlistOnly && (
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
            {lang === "en" ? "Leave a review" : "Dejar una reseña"}
          </a>
        </div>

        {hasContact && (
          <div
            className="pb-10 pt-4 border-t text-xs opacity-60 flex flex-col gap-1.5"
            style={{ borderColor: "color-mix(in srgb, currentColor 10%, transparent)", color: tenant.menuPageTextColor }}
          >
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

      {tenant.menuLeadEnabled && (
        <div className="flex justify-center px-6 pt-2">
          <button
            onClick={() => setLeadModalOpen(true)}
            className="w-full max-w-sm py-3 rounded-xl font-semibold text-sm shadow-[0_4px_20px_-8px_rgba(0,0,0,0.15)] hover:brightness-105 transition-all"
            style={{ backgroundColor: tenant.buttonColor, color: tenant.buttonTextColor }}
          >
            {tenant.menuLeadButtonLabel}
          </button>
        </div>
      )}

      <div className="flex justify-center py-6 opacity-50">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo.svg" alt="Zertoo" className="h-4 w-auto" />
      </div>

      {tenant.contactPhone && (
        <a
          href={`tel:${tenant.contactPhone.replace(/\s+/g, "")}`}
          className="fixed bottom-5 right-5 z-30 flex items-center gap-2 text-sm font-semibold px-4 py-3 rounded-full shadow-lg hover:brightness-105 transition-all"
          style={{ backgroundColor: tenant.buttonColor, color: tenant.buttonTextColor }}
        >
          <Phone size={15} aria-hidden />
          {lang === "en" ? "Call" : "Llamar"}
        </a>
      )}

      <FaqChatWidget
        tenantSlug={tenant.slug}
        buttonColor={tenant.buttonColor}
        buttonTextColor={tenant.buttonTextColor}
        themeBgColor={tenant.themeBgColor}
        themeTextColor={tenant.themeTextColor}
      />

      {zoomedItem && (
        <div
          className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4"
          onClick={() => setZoomedItem(null)}
        >
          <div
            className="w-full max-w-md rounded-2xl overflow-hidden"
            style={{ backgroundColor: tenant.themeBgColor, color: tenant.themeTextColor }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="relative">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={zoomedItem.imageUrl!}
                alt={zoomedItem.name}
                className="w-full max-h-[70vh] object-contain bg-black/5"
              />
              <button
                onClick={() => setZoomedItem(null)}
                aria-label={lang === "en" ? "Close" : "Cerrar"}
                className="absolute top-3 right-3 bg-black/60 text-white rounded-full p-2 hover:bg-black/75"
              >
                <X size={18} aria-hidden />
              </button>
            </div>
            <div className="px-5 py-4">
              <div className="flex items-baseline justify-between gap-3">
                <p className="text-lg font-bold">{zoomedItem.name}</p>
                {zoomedItem.status === "SOLD_OUT" ? (
                  <span className="text-xs px-2 py-0.5 rounded-md bg-red-50 text-red-700 shrink-0">{lang === "en" ? "Sold out" : "Agotado"}</span>
                ) : (
                  <span className="text-lg font-bold shrink-0">
                    {priceLabel(zoomedItem)}
                  </span>
                )}
              </div>
              {itemDescription(zoomedItem) && (
                <p className="text-sm opacity-70 mt-1.5">{itemDescription(zoomedItem)}</p>
              )}
            </div>
          </div>
        </div>
      )}

      {leadModalOpen && (
        <LeadClaimModal
          slug={tenant.slug}
          rewardLabel={tenant.menuLeadButtonLabel}
          buttonColor={tenant.buttonColor}
          buttonTextColor={tenant.buttonTextColor}
          lang={lang}
          onClose={() => setLeadModalOpen(false)}
        />
      )}

      {cartCount > 0 && !checkoutOpen && (
        <button
          onClick={() => setCheckoutOpen(true)}
          className="fixed bottom-0 left-0 right-0 z-40 flex items-center justify-between px-6 py-4 font-semibold text-sm shadow-[0_-8px_24px_-8px_rgba(0,0,0,0.15)]"
          style={{ backgroundColor: tenant.buttonColor, color: tenant.buttonTextColor }}
        >
          <span>
            {cartCount} {lang === "en" ? (cartCount === 1 ? "item" : "items") : cartCount === 1 ? "ítem" : "ítems"}
          </span>
          <span className="flex items-center gap-2">
            {formatCurrency(cartSubtotal, tenant.currency)}
            <ArrowRight size={16} aria-hidden />
          </span>
        </button>
      )}

      {customizeItem && (
        <ItemCustomizeModal
          item={customizeItem}
          currency={tenant.currency}
          buttonColor={tenant.buttonColor}
          buttonTextColor={tenant.buttonTextColor}
          lang={lang}
          onClose={() => setCustomizeItem(null)}
          onAdd={(line) => {
            addCustomizedLine(line);
            setCustomizeItem(null);
          }}
        />
      )}

      {checkoutOpen && (
        <CheckoutModal
          slug={tenant.slug}
          currency={tenant.currency}
          pickupEnabled={tenant.pickupEnabled}
          deliveryEnabled={tenant.deliveryEnabled}
          deliveryFee={tenant.deliveryFee}
          minDeliveryAmount={tenant.minDeliveryAmount}
          buttonColor={tenant.buttonColor}
          buttonTextColor={tenant.buttonTextColor}
          cartLines={cartLines}
          allItems={allItems}
          subtotal={cartSubtotal}
          lineTotal={lineTotal}
          onRemoveLine={removeLine}
          language={lang}
          onClose={() => setCheckoutOpen(false)}
          onSuccess={() => {
            setCartLines([]);
            setCheckoutOpen(false);
          }}
        />
      )}
    </div>
  );
}

function LeadClaimModal({
  slug,
  rewardLabel,
  buttonColor,
  buttonTextColor,
  lang,
  onClose,
}: {
  slug: string;
  rewardLabel: string;
  buttonColor: string;
  buttonTextColor: string;
  lang: Lang;
  onClose: () => void;
}) {
  const [form, setForm] = useState({ name: "", email: "", phone: "" });
  const [status, setStatus] = useState<"idle" | "sending" | "done" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const [alreadyClaimed, setAlreadyClaimed] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("sending");
    try {
      const res = await fetch("/api/public/menu-leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug, ...form }),
      });
      const body = await res.json();
      if (!res.ok) {
        setErrorMsg(body.error ?? (lang === "en" ? "Couldn't process your request" : "No se pudo procesar tu solicitud"));
        setStatus("error");
        return;
      }
      setAlreadyClaimed(Boolean(body.alreadyClaimed));
      setStatus("done");
    } catch {
      setErrorMsg(lang === "en" ? "Couldn't connect to the server. Please try again." : "No se pudo conectar con el servidor. Intenta de nuevo.");
      setStatus("error");
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="w-full max-w-sm bg-white rounded-2xl p-6 text-neutral-800"
        onClick={(e) => e.stopPropagation()}
      >
        {status === "done" ? (
          <div className="text-center">
            <p className="text-lg font-semibold mb-2">
              {alreadyClaimed
                ? lang === "en"
                  ? "You already claimed your reward"
                  : "Ya habías reclamado tu premio"
                : lang === "en"
                  ? "All set!"
                  : "¡Listo!"}
            </p>
            <p className="text-sm opacity-70 mb-4">
              {alreadyClaimed
                ? lang === "en"
                  ? "We resent your code by WhatsApp — check your messages."
                  : "Te reenviamos tu código por WhatsApp — revisa tus mensajes."
                : lang === "en"
                  ? "We sent your claim code by WhatsApp. Show it on your next visit."
                  : "Te mandamos tu código de canje por WhatsApp. Muéstralo en tu próxima visita."}
            </p>
            <button
              onClick={onClose}
              className="w-full py-2.5 rounded-lg text-sm font-semibold"
              style={{ backgroundColor: buttonColor, color: buttonTextColor }}
            >
              {lang === "en" ? "Close" : "Cerrar"}
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col gap-3">
            <p className="text-lg font-semibold mb-1">{rewardLabel}</p>
            <p className="text-sm opacity-70 mb-2">
              {lang === "en"
                ? "Leave your info and we'll send your claim code by WhatsApp."
                : "Déjanos tus datos y te mandamos tu código de canje por WhatsApp."}
            </p>
            <input
              placeholder={lang === "en" ? "Your name" : "Tu nombre"}
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              required
              className="w-full px-3 py-2.5 rounded-lg border border-neutral-200 text-sm"
            />
            <input
              type="email"
              placeholder={lang === "en" ? "name@email.com" : "name@correo.com"}
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              required
              className="w-full px-3 py-2.5 rounded-lg border border-neutral-200 text-sm"
            />
            <input
              type="tel"
              placeholder={lang === "en" ? "Your WhatsApp (with country code)" : "Tu WhatsApp (con código de país)"}
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
              required
              className="w-full px-3 py-2.5 rounded-lg border border-neutral-200 text-sm"
            />
            {status === "error" && <p className="text-red-600 text-sm">{errorMsg}</p>}
            <div className="flex gap-2 mt-1">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 py-2.5 rounded-lg border border-neutral-200 text-sm"
              >
                {lang === "en" ? "Cancel" : "Cancelar"}
              </button>
              <button
                type="submit"
                disabled={status === "sending"}
                className="flex-1 py-2.5 rounded-lg text-sm font-semibold disabled:opacity-50"
                style={{ backgroundColor: buttonColor, color: buttonTextColor }}
              >
                {status === "sending" ? (lang === "en" ? "Sending..." : "Enviando...") : lang === "en" ? "Claim" : "Reclamar"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

function CheckoutModal({
  slug,
  currency,
  pickupEnabled,
  deliveryEnabled,
  deliveryFee,
  minDeliveryAmount,
  buttonColor,
  buttonTextColor,
  cartLines,
  allItems,
  subtotal,
  lineTotal,
  onRemoveLine,
  language,
  onClose,
  onSuccess,
}: {
  slug: string;
  currency: string;
  pickupEnabled: boolean;
  deliveryEnabled: boolean;
  deliveryFee: number | null;
  minDeliveryAmount: number | null;
  buttonColor: string;
  buttonTextColor: string;
  cartLines: CartLine[];
  allItems: MenuItemData[];
  subtotal: number;
  lineTotal: (line: CartLine) => number;
  onRemoveLine: (lineId: string) => void;
  language: Lang;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const defaultFulfillment: "PICKUP" | "DELIVERY" = pickupEnabled ? "PICKUP" : "DELIVERY";
  const [fulfillment, setFulfillment] = useState<"PICKUP" | "DELIVERY">(defaultFulfillment);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [orderNotes, setOrderNotes] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "done" | "error">("idle");
  const [error, setError] = useState("");

  const fee = fulfillment === "DELIVERY" ? (deliveryFee ?? 0) : 0;
  const total = subtotal + fee;
  const belowMinimum =
    fulfillment === "DELIVERY" && minDeliveryAmount !== null && subtotal < minDeliveryAmount;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (belowMinimum) return;
    setStatus("sending");
    setError("");
    try {
      const res = await fetch("/api/public/menu-orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          slug,
          customerName: name,
          customerEmail: email,
          customerPhone: phone,
          fulfillment,
          deliveryAddress: fulfillment === "DELIVERY" ? address : undefined,
          notes: orderNotes || undefined,
          language,
          items: cartLines.map((l) => ({
            menuItemId: l.menuItemId,
            quantity: l.quantity,
            addOnIds: l.addOnIds,
            notes: l.notes || undefined,
          })),
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError(body.error ?? (language === "en" ? "Couldn't send your order" : "No se pudo enviar tu pedido"));
        setStatus("error");
        return;
      }
      setStatus("done");
    } catch {
      setError(language === "en" ? "Couldn't connect to the server. Please try again." : "No se pudo conectar con el servidor. Intenta de nuevo.");
      setStatus("error");
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-end sm:items-center justify-center" onClick={onClose}>
      <div
        className="w-full sm:max-w-sm bg-white rounded-t-2xl sm:rounded-2xl p-6 text-neutral-800 max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {status === "done" ? (
          <div className="text-center py-6">
            <p className="text-lg font-semibold mb-2">{language === "en" ? "Order sent!" : "¡Pedido enviado!"}</p>
            <p className="text-sm opacity-70 mb-4">
              {language === "en" ? "We sent the confirmation by email and WhatsApp." : "Te mandamos la confirmación por correo y WhatsApp."}
            </p>
            <button
              onClick={onSuccess}
              className="w-full py-2.5 rounded-lg text-sm font-semibold"
              style={{ backgroundColor: buttonColor, color: buttonTextColor }}
            >
              {language === "en" ? "Close" : "Cerrar"}
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col gap-3">
            <p className="text-lg font-semibold mb-1">{language === "en" ? "Your order" : "Tu pedido"}</p>

            <div className="flex flex-col gap-2 mb-2">
              {cartLines.map((line) => {
                const item = allItems.find((i) => i.id === line.menuItemId);
                if (!item) return null;
                const selectedAddOns = line.addOnIds
                  .map((id) => item.addOns.find((a) => a.id === id))
                  .filter((a): a is MenuItemAddOnData => Boolean(a));
                return (
                  <div key={line.lineId} className="flex justify-between text-sm gap-2">
                    <div className="flex-1 min-w-0">
                      <p>
                        {line.quantity}x {item.name}
                      </p>
                      {selectedAddOns.length > 0 && (
                        <p className="text-xs opacity-60 pl-3">
                          + {selectedAddOns.map((a) => a.name).join(", ")}
                        </p>
                      )}
                      {line.notes && <p className="text-xs opacity-60 pl-3">{language === "en" ? "Note" : "Nota"}: {line.notes}</p>}
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span>{formatCurrency(lineTotal(line), currency)}</span>
                      <button
                        type="button"
                        onClick={() => onRemoveLine(line.lineId)}
                        aria-label={language === "en" ? "Remove" : "Quitar"}
                        className="opacity-50 hover:opacity-100"
                      >
                        <X size={14} aria-hidden />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            {(pickupEnabled || deliveryEnabled) && pickupEnabled && deliveryEnabled && (
              <div className="flex gap-2 mb-1">
                <button
                  type="button"
                  onClick={() => setFulfillment("PICKUP")}
                  className={`flex-1 py-2 rounded-lg text-sm font-medium border ${fulfillment === "PICKUP" ? "border-neutral-800" : "border-neutral-200"}`}
                >
                  Pickup
                </button>
                <button
                  type="button"
                  onClick={() => setFulfillment("DELIVERY")}
                  className={`flex-1 py-2 rounded-lg text-sm font-medium border ${fulfillment === "DELIVERY" ? "border-neutral-800" : "border-neutral-200"}`}
                >
                  Delivery
                </button>
              </div>
            )}

            {fulfillment === "DELIVERY" && (
              <input
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                required
                placeholder={language === "en" ? "Delivery address" : "Dirección de entrega"}
                className="w-full px-3 py-2.5 rounded-lg border border-neutral-200 text-sm"
              />
            )}

            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              placeholder={language === "en" ? "Your name" : "Tu nombre"}
              className="w-full px-3 py-2.5 rounded-lg border border-neutral-200 text-sm"
            />
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              placeholder={language === "en" ? "Your email" : "Tu correo"}
              className="w-full px-3 py-2.5 rounded-lg border border-neutral-200 text-sm"
            />
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              required
              placeholder={language === "en" ? "Your WhatsApp (with country code)" : "Tu WhatsApp (con código de país)"}
              className="w-full px-3 py-2.5 rounded-lg border border-neutral-200 text-sm"
            />
            <textarea
              value={orderNotes}
              onChange={(e) => setOrderNotes(e.target.value)}
              rows={2}
              placeholder={language === "en" ? "General order notes (optional)" : "Notas del pedido en general (opcional)"}
              className="w-full px-3 py-2.5 rounded-lg border border-neutral-200 text-sm resize-none"
            />

            {fee > 0 && (
              <div className="flex justify-between text-sm opacity-70">
                <span>{language === "en" ? "Delivery fee" : "Envío"}</span>
                <span>{formatCurrency(fee, currency)}</span>
              </div>
            )}
            <div className="flex justify-between text-base font-bold border-t border-neutral-100 pt-2">
              <span>Total</span>
              <span>{formatCurrency(total, currency)}</span>
            </div>

            {belowMinimum && (
              <p className="text-xs text-red-600">
                {language === "en"
                  ? `The minimum order for delivery is ${formatCurrency(minDeliveryAmount!, currency)}.`
                  : `El pedido mínimo para delivery es ${formatCurrency(minDeliveryAmount!, currency)}.`}
              </p>
            )}
            {status === "error" && <p className="text-sm text-red-600">{error}</p>}

            <div className="flex gap-2 mt-1">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 py-2.5 rounded-lg border border-neutral-200 text-sm"
              >
                {language === "en" ? "Cancel" : "Cancelar"}
              </button>
              <button
                type="submit"
                disabled={status === "sending" || belowMinimum || cartLines.length === 0}
                className="flex-1 py-2.5 rounded-lg text-sm font-semibold disabled:opacity-50"
                style={{ backgroundColor: buttonColor, color: buttonTextColor }}
              >
                {status === "sending"
                  ? language === "en"
                    ? "Sending..."
                    : "Enviando..."
                  : language === "en"
                    ? "Confirm order"
                    : "Confirmar pedido"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

function ItemCustomizeModal({
  item,
  currency,
  buttonColor,
  buttonTextColor,
  lang,
  onClose,
  onAdd,
}: {
  item: MenuItemData;
  currency: string;
  buttonColor: string;
  buttonTextColor: string;
  lang: Lang;
  onClose: () => void;
  onAdd: (line: Omit<CartLine, "lineId">) => void;
}) {
  const [selectedAddOnIds, setSelectedAddOnIds] = useState<string[]>([]);
  const [quantity, setQuantity] = useState(1);
  const [notes, setNotes] = useState("");

  function toggleAddOn(id: string) {
    setSelectedAddOnIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  const addOnsTotal = selectedAddOnIds.reduce((sum, id) => {
    const addOn = item.addOns.find((a) => a.id === id);
    return sum + (addOn?.price ?? 0);
  }, 0);
  const lineTotal = (item.price + addOnsTotal) * quantity;

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-end sm:items-center justify-center" onClick={onClose}>
      <div
        className="w-full sm:max-w-sm bg-white rounded-t-2xl sm:rounded-2xl p-6 text-neutral-800 max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <p className="text-lg font-semibold mb-1">{item.name}</p>
        <p className="text-sm opacity-60 mb-4">{formatCurrency(item.price, currency)}</p>

        {item.addOns.length > 0 && (
          <div className="flex flex-col gap-2 mb-4">
            <p className="text-xs font-semibold uppercase opacity-60">{lang === "en" ? "Add-ons" : "Extras"}</p>
            {item.addOns.map((addOn) => (
              <label key={addOn.id} className="flex items-center justify-between gap-2 text-sm cursor-pointer">
                <span className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={selectedAddOnIds.includes(addOn.id)}
                    onChange={() => toggleAddOn(addOn.id)}
                    className="w-4 h-4"
                  />
                  {addOn.name}
                </span>
                <span className="opacity-60">
                  {addOn.price > 0 ? `+${formatCurrency(addOn.price, currency)}` : lang === "en" ? "Free" : "Gratis"}
                </span>
              </label>
            ))}
          </div>
        )}

        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={2}
          placeholder={
            lang === "en" ? "Anything specific for this dish (optional), e.g. no onion" : "Algo específico para este plato (opcional), ej. sin cebolla"
          }
          className="w-full px-3 py-2.5 rounded-lg border border-neutral-200 text-sm resize-none mb-4"
        />

        <div className="flex items-center justify-between mb-5">
          <span className="text-sm font-medium">{lang === "en" ? "Quantity" : "Cantidad"}</span>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setQuantity((q) => Math.max(1, q - 1))}
              aria-label={lang === "en" ? "Remove one" : "Quitar uno"}
              className="w-7 h-7 rounded-full border border-neutral-200 flex items-center justify-center"
            >
              −
            </button>
            <span className="text-sm font-semibold w-4 text-center">{quantity}</span>
            <button
              type="button"
              onClick={() => setQuantity((q) => q + 1)}
              aria-label={lang === "en" ? "Add one" : "Agregar uno"}
              className="w-7 h-7 rounded-full border border-neutral-200 flex items-center justify-center"
            >
              +
            </button>
          </div>
        </div>

        <div className="flex gap-2">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-2.5 rounded-lg border border-neutral-200 text-sm"
          >
            {lang === "en" ? "Cancel" : "Cancelar"}
          </button>
          <button
            type="button"
            onClick={() => onAdd({ menuItemId: item.id, quantity, addOnIds: selectedAddOnIds, notes })}
            className="flex-1 py-2.5 rounded-lg text-sm font-semibold"
            style={{ backgroundColor: buttonColor, color: buttonTextColor }}
          >
            {lang === "en" ? "Add" : "Agregar"} · {formatCurrency(lineTotal, currency)}
          </button>
        </div>
      </div>
    </div>
  );
}
