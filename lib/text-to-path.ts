import fs from "fs";
import opentype from "opentype.js";

// El texto de los pases de Wallet se venía dibujando con <text> +
// font-family, pero eso depende de que el SERVIDOR tenga esa fuente
// instalada — algo que resultó no ser confiable en Railway pese a
// varios intentos (instalarla vía apt, forzar fc-cache). La solución
// definitiva: convertir el texto directamente a trazos vectoriales
// (los mismos <path> que ya se usan para dibujar los sellos), usando
// una fuente que viaja empaquetada con el propio proyecto — así no
// depende de nada externo al código, nunca.
//
// La fuente se carga una sola vez y se reutiliza en cada pase que se
// genera después — leerla de disco en cada request sería un
// desperdicio, dado que el archivo no cambia entre pedidos.
let cachedFont: opentype.Font | null = null;

function loadFont(): opentype.Font {
  if (cachedFont) return cachedFont;
  const fontPath = require.resolve("@fontsource/roboto/files/roboto-latin-700-normal.woff");
  const buffer = fs.readFileSync(fontPath);
  const arrayBuffer = buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);
  cachedFont = opentype.parse(arrayBuffer);
  return cachedFont;
}

export interface TextPathResult {
  pathData: string;
  width: number;
}

// Arma el path letra por letra con font.charToGlyph() (va directo por
// la tabla cmap) en vez de font.getPath() (que usa el pipeline
// completo de sustituciones tipográficas avanzadas de OpenType) —
// varias fuentes actuales (Inter, Roboto) tienen tablas de
// sustitución que la versión de opentype.js usada acá no soporta
// todavía, y font.getPath() falla con ellas. Para texto simple en
// español (sin ligaduras ni scripts complejos), esta vía más directa
// alcanza perfecto y evita ese problema por completo.
export function textToPath(text: string, x: number, y: number, fontSize: number): TextPathResult {
  const font = loadFont();
  const scale = fontSize / font.unitsPerEm;
  let cursorX = x;
  const combined = new opentype.Path();
  for (const char of text) {
    const glyph = font.charToGlyph(char);
    combined.extend(glyph.getPath(cursorX, y, fontSize));
    cursorX += glyph.advanceWidth * scale;
  }
  return { pathData: combined.toPathData(2), width: cursorX - x };
}

// Mide el ancho sin generar el path completo — más liviano cuando
// solo hace falta decidir un tamaño de fuente que entre en un
// espacio disponible, antes de generar el path definitivo.
export function measureTextWidth(text: string, fontSize: number): number {
  const font = loadFont();
  const scale = fontSize / font.unitsPerEm;
  let width = 0;
  for (const char of text) {
    width += font.charToGlyph(char).advanceWidth * scale;
  }
  return width;
}
