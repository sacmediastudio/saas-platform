// Contraste de color (WCAG 2.1): los negocios eligen sus propios colores
// en Ajustes, así que el menú público corrige en el momento las
// combinaciones que no se pueden leer bien (mínimo 4,5:1 para texto normal).

export interface Rgb {
  r: number;
  g: number;
  b: number;
}

export function parseColor(input: string): Rgb | null {
  const s = input.trim().toLowerCase();
  const hex = s.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/);
  if (hex) {
    const h = hex[1].length === 3 ? hex[1].split("").map((c) => c + c).join("") : hex[1];
    return { r: parseInt(h.slice(0, 2), 16), g: parseInt(h.slice(2, 4), 16), b: parseInt(h.slice(4, 6), 16) };
  }
  const rgb = s.match(/^rgba?\(([^)]+)\)$/);
  if (rgb) {
    const p = rgb[1].split(",").map((x) => parseFloat(x));
    if (p.length >= 3 && p.slice(0, 3).every((n) => Number.isFinite(n))) return { r: p[0], g: p[1], b: p[2] };
  }
  return null;
}

function toHex({ r, g, b }: Rgb): string {
  const h = (n: number) => Math.round(Math.max(0, Math.min(255, n))).toString(16).padStart(2, "0");
  return `#${h(r)}${h(g)}${h(b)}`;
}

function luminance({ r, g, b }: Rgb): number {
  const f = (v: number) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
}

export function contrastRatio(fg: string, bg: string): number | null {
  const a = parseColor(fg);
  const b = parseColor(bg);
  if (!a || !b) return null;
  const l1 = luminance(a);
  const l2 = luminance(b);
  return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
}

export const MIN_TEXT_CONTRAST = 4.5;

/** Si `fg` ya contrasta lo suficiente contra `bg` se deja igual; si no, negro o blanco (el que más contraste dé). */
export function ensureContrast(fg: string, bg: string, min = MIN_TEXT_CONTRAST): string {
  const ratio = contrastRatio(fg, bg);
  if (ratio === null || ratio >= min) return fg;
  const dark = contrastRatio("#111111", bg) ?? 0;
  const light = contrastRatio("#ffffff", bg) ?? 0;
  return dark >= light ? "#111111" : "#ffffff";
}

/**
 * Gris "atenuado" para textos secundarios (descripciones, segunda moneda):
 * mezcla el color del texto con el fondo de la tarjeta, subiendo la
 * intensidad hasta llegar al contraste mínimo. Reemplaza al "opacity-60",
 * que sobre fondos medios quedaba en 3:1.
 */
export function mutedColor(fg: string, bg: string, min = MIN_TEXT_CONTRAST): string {
  const a = parseColor(fg);
  const b = parseColor(bg);
  if (!a || !b) return fg;
  for (let t = 0.62; t <= 1.0001; t += 0.02) {
    const mix = { r: a.r * t + b.r * (1 - t), g: a.g * t + b.g * (1 - t), b: a.b * t + b.b * (1 - t) };
    const ratio = contrastRatio(toHex(mix), bg);
    if (ratio !== null && ratio >= min) return toHex(mix);
  }
  return fg;
}
