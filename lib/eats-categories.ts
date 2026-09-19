// Mismas 26 categorías y etiquetas que ya usa el sitio web de Zertoo
// Eats (proyecto aparte, misma base de datos) — se duplican acá para
// que la API pueda devolver la etiqueta ya traducida en la respuesta,
// sin que la app móvil (u otro consumidor de esta API) necesite
// mantener su propia copia de este mapeo. Si se agrega una categoría
// nueva al enum NowCategory de prisma/schema.prisma, hay que agregarla
// acá también (y en el proyecto de Zertoo Eats, que sigue siendo el
// dueño canónico de esta lista).
export const EATS_CATEGORY_LABELS: Record<"es" | "en", Record<string, string>> = {
  es: {
    ITALIAN: "Italiana",
    FRENCH: "Francesa",
    LOCAL: "Local",
    COLOMBIAN: "Colombiana",
    MEXICAN: "Mexicana",
    INTERNATIONAL: "Internacional",
    ASIAN: "Asiática",
    JAPANESE: "Japonesa",
    CHINESE: "China",
    INDIAN: "India",
    STEAKHOUSE: "Steakhouse",
    SEAFOOD: "Mariscos",
    SUSHI: "Sushi",
    PIZZERIA: "Pizzería",
    BURGERS: "Hamburguesas",
    FAST_FOOD: "Comida rápida",
    BBQ_GRILL: "BBQ & Grill",
    CAFE: "Café",
    BAKERY_PASTRY: "Bakery & Pastry",
    BREAKFAST_BRUNCH: "Desayuno & Brunch",
    ICE_CREAM_GELATO: "Helados & Gelato",
    DESSERTS: "Postres",
    VEGETARIAN_VEGAN: "Vegetariana & Vegana",
    BAR_PUB: "Bar & Pub",
    BEACH_BAR: "Beach Bar",
    FOOD_TRUCK: "Food Truck",
  },
  en: {
    ITALIAN: "Italian",
    FRENCH: "French",
    LOCAL: "Local",
    COLOMBIAN: "Colombian",
    MEXICAN: "Mexican",
    INTERNATIONAL: "International",
    ASIAN: "Asian",
    JAPANESE: "Japanese",
    CHINESE: "Chinese",
    INDIAN: "Indian",
    STEAKHOUSE: "Steakhouse",
    SEAFOOD: "Seafood",
    SUSHI: "Sushi",
    PIZZERIA: "Pizzeria",
    BURGERS: "Burgers",
    FAST_FOOD: "Fast Food",
    BBQ_GRILL: "BBQ & Grill",
    CAFE: "Café",
    BAKERY_PASTRY: "Bakery & Pastry",
    BREAKFAST_BRUNCH: "Breakfast & Brunch",
    ICE_CREAM_GELATO: "Ice Cream & Gelato",
    DESSERTS: "Desserts",
    VEGETARIAN_VEGAN: "Vegetarian & Vegan",
    BAR_PUB: "Bar & Pub",
    BEACH_BAR: "Beach Bar",
    FOOD_TRUCK: "Food Truck",
  },
};

export function eatsCategoryLabel(category: string | null, lang: "es" | "en"): string | null {
  if (!category) return null;
  return EATS_CATEGORY_LABELS[lang][category] ?? category;
}

// Símbolos de precio ($ a $$$$) — mismo signo en cualquier idioma, no
// hace falta traducción por lang como con las categorías.
export const EATS_PRICE_RANGE_LABELS: Record<string, string> = {
  BUDGET: "$",
  MODERATE: "$$",
  EXPENSIVE: "$$$",
  LUXURY: "$$$$",
};

export function eatsPriceRangeLabel(range: string | null): string | null {
  if (!range) return null;
  return EATS_PRICE_RANGE_LABELS[range] ?? range;
}

// Etiquetas del estado de horario (ver lib/availability.ts para el
// cálculo) — mismo criterio que EATS_CATEGORY_LABELS: se devuelve ya
// traducido desde el server para que la app móvil no mantenga su
// propia copia.
export const EATS_HOURS_STATUS_LABELS: Record<"es" | "en", Record<string, string>> = {
  es: {
    OPEN: "Abierto",
    CLOSED: "Cerrado",
    OPENING_SOON: "Abre pronto",
    CLOSING_SOON: "Cierra pronto",
  },
  en: {
    OPEN: "Open",
    CLOSED: "Closed",
    OPENING_SOON: "Opening soon",
    CLOSING_SOON: "Closing soon",
  },
};

export function eatsHoursStatusLabel(status: string, lang: "es" | "en"): string {
  return EATS_HOURS_STATUS_LABELS[lang][status] ?? status;
}

// Distancia entre dos puntos en la Tierra, en km — misma fórmula
// exacta que ya usa el sitio web de Zertoo Eats (app/page.tsx de ese
// proyecto), copiada tal cual para que "cerca de mí" dé el mismo
// resultado sin importar si lo pide el sitio web o la app móvil.
export function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// Mismo límite que el sitio web — más que de sobra para Aruba (32 km
// de punta a punta).
export const EATS_MAX_NEAR_ME_KM = 20;
