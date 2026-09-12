import fs from "fs";
import path from "path";
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
// El archivo .woff vive copiado en lib/fonts/ (no se lee desde
// node_modules de @fontsource vía require.resolve) porque Webpack, al
// compilar las rutas de la API, intenta "empaquetar" cualquier
// archivo al que apunte un require.resolve() — y al no tener un
// loader configurado para .woff, el build entero fallaba. Leerlo con
// fs + una ruta armada en tiempo de ejecución (process.cwd(), no un
// literal que Webpack pueda analizar de forma estática) evita que
// Webpack se entere de este archivo en absoluto.
//
// La fuente se carga una sola vez y se reutiliza en cada pase que se
// genera después — leerla de disco en cada request sería un
// desperdicio, dado que el archivo no cambia entre pedidos.
let cachedFont: opentype.Font | null = null;

function loadFont(): opentype.Font {
  if (cachedFont) return cachedFont;
  const fontPath = path.join(process.cwd(), "lib", "fonts", "roboto-bold.woff");
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
    cursorX += (glyph.advanceWidth ?? 0) * scale;
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
    width += (font.charToGlyph(char).advanceWidth ?? 0) * scale;
  }
  return width;
}
