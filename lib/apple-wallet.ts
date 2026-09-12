import crypto from "crypto";
import sharp from "sharp";
import { PKPass } from "passkit-generator";

// Apple pide los colores como "rgb(r, g, b)", pero en toda la
// plataforma los colores del negocio se guardan en hex (#RRGGBB) —
// esto convierte de un formato al otro.
function hexToRgb(hex: string): string {
  const clean = hex.replace("#", "");
  const r = parseInt(clean.substring(0, 2), 16);
  const g = parseInt(clean.substring(2, 4), 16);
  const b = parseInt(clean.substring(4, 6), 16);
  return `rgb(${r}, ${g}, ${b})`;
}

// El token que cada dispositivo manda de vuelta en cada llamada al
// servicio web, para probar que realmente tiene ese pase — sin
// guardar un secreto por tarjeta aparte, se deriva de forma
// determinística a partir del id de la tarjeta y una clave del
// servidor. Si alguna vez cambia WALLET_AUTH_SECRET, todos los pases
// ya entregados dejan de autenticar — no rotarla sin necesidad real.
export function authTokenFor(loyaltyCardId: string): string {
  const secret = process.env.WALLET_AUTH_SECRET || "";
  return crypto.createHmac("sha256", secret).update(loyaltyCardId).digest("hex");
}

interface LoyaltyCardData {
  id: string;
  customerName: string | null;
  stamps: number;
}

interface TenantBrandData {
  name: string;
  logoUrl: string | null;
  walletLogoUrl: string | null;
  buttonColor: string;
  themeTextColor: string;
  loyaltyVisitsNeeded: number;
  loyaltyReward: string;
}

function isApplePassConfigured(): boolean {
  return Boolean(
    process.env.APPLE_PASS_TYPE_IDENTIFIER &&
      process.env.APPLE_TEAM_IDENTIFIER &&
      process.env.APPLE_PASS_SIGNER_CERT_BASE64 &&
      process.env.APPLE_PASS_SIGNER_KEY_BASE64 &&
      process.env.APPLE_WWDR_CERT_BASE64 &&
      process.env.WALLET_AUTH_SECRET
  );
}

// XML prohíbe ciertos caracteres de control incluso escapados con
// entidades (&amp; etc. no alcanza para estos) — si un nombre de
// negocio se copió y pegó desde Word, un PDF, o algún teclado que
// dejó un caracter invisible de este tipo, se cuela sin que ninguno
// de los 5 reemplazos de abajo lo detecte. Se los quita directamente
// antes de escapar el resto.
function stripIllegalXmlChars(s: string): string {
  // eslint-disable-next-line no-control-regex
  return s.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, "");
}

function escapeXml(s: string): string {
  return stripIllegalXmlChars(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

// El nombre del negocio ya se escapaba antes de insertarse en el SVG,
// pero los colores del negocio (backgroundColorHex/textColorHex) se
// insertaban DIRECTO en los atributos, sin validar — si algún tenant
// tuviera guardado un valor que no sea un hex limpio (por los motivos
// que sea: un bug viejo, una edición manual de la base de datos),
// ese valor se cuela tal cual dentro de un atributo de SVG y puede
// romper el XML (esto es lo que causaba el "Couldn't find end of
// Start Tag" al generar el pase para uno de los negocios). Cualquier
// valor que no sea EXACTAMENTE #RRGGBB cae al color de respaldo.
function sanitizeHexColor(color: string, fallback: string): string {
  return /^#[0-9A-Fa-f]{6}$/.test(color) ? color : fallback;
}

interface StripContent {
  tenantName: string;
  logoUrl: string | null;
  backgroundColorHex: string;
  textColorHex: string;
  stamps: number;
  visitsNeeded: number;
  remainingLabel: string;
}

// El "check" de cada sello se dibuja como 3 segmentos relativos al
// radio del círculo, en vez de un ícono de fuente — así no depende
// para nada de qué fuentes/emoji estén instalados en el servidor.
function checkmarkPath(cx: number, cy: number, r: number): string {
  const x1 = cx - r * 0.5, y1 = cy + r * 0.02;
  const x2 = cx - r * 0.12, y2 = cy + r * 0.38;
  const x3 = cx + r * 0.55, y3 = cy - r * 0.32;
  return `M ${x1} ${y1} L ${x2} ${y2} L ${x3} ${y3}`;
}

// Fondo, nombre del negocio y sellos — TODO lo que se puede dibujar
// con formas y texto plano. El logo se deja afuera a propósito: antes
// se insertaba como imagen incrustada dentro del propio texto del
// SVG, y ese camino (SVG → PNG vía librsvg, la librería que usa sharp
// por dentro) no respeta bien la transparencia de imágenes
// incrustadas así — el resultado terminaba con fondo negro en vez de
// transparente. Componer el logo aparte, con sharp.composite(),
// evita ese problema de raíz porque usa un camino distinto que sí
// respeta el canal alfa correctamente.
//
// Distribución (logo circular arriba a la izquierda, nombre arriba a
// la derecha, sellos en una grilla de hasta 5 columnas por fila, y el
// texto de "cuántos faltan" debajo) sigue el layout de referencia del
// diseño aprobado — adaptado al aspect ratio real y angosto que Apple
// exige para el "strip" de un storeCard (~375x123pt @1x), que es
// mucho más bajo que un mockup cuadrado. Verificado renderizando con
// sharp/librsvg + DejaVu Sans localmente antes de este cambio.
function buildBaseSvg(content: StripContent, width: number, height: number): Buffer {
  const scale = width / 1125; // todas las medidas están pensadas para el ancho @3x, y se escalan para 1x/2x
  const bgColor = sanitizeHexColor(content.backgroundColorHex, "#E7FF00");
  const textColor = sanitizeHexColor(content.textColorHex, "#002D09");

  const sideMargin = 60 * scale;
  const usableWidth = width - sideMargin * 2;

  const logoDiameter = 112 * scale;
  const logoLeft = 45 * scale;
  const logoTop = 24 * scale;
  const logoCenterY = logoTop + logoDiameter / 2;

  // Nombre del negocio, alineado verticalmente con el logo. El
  // tamaño se reduce para nombres largos para que el texto nunca
  // invada el círculo del logo (con el tamaño fijo anterior, un
  // nombre largo se dibujaba literalmente encima del logo).
  const baseNameFontSize = 50 * scale;
  const minNameFontSize = 26 * scale;
  const nameLeftBoundary = logoLeft + logoDiameter + 24 * scale;
  const maxNameWidth = width - sideMargin - nameLeftBoundary;
  const avgCharWidthFactor = 0.58; // aproximación para DejaVu Sans Bold
  const nameLen = Math.max(content.tenantName.length, 1);
  const nameFontSize = Math.max(
    minNameFontSize,
    Math.min(baseNameFontSize, maxNameWidth / (nameLen * avgCharWidthFactor))
  );
  const nameY = logoCenterY + nameFontSize * 0.35;

  // Grilla de sellos: hasta 5 columnas por fila, tantas filas como
  // hagan falta (antes todo iba en una sola fila apretada). Si la
  // última fila queda incompleta, se centra en vez de quedar pegada
  // a la izquierda. Math.max(..., 1) evita una división por cero si
  // loyaltyVisitsNeeded llegara a estar en 0 — sin esto, colSpacing
  // se vuelve Infinity y arrastra ese valor a cada círculo de la
  // grilla.
  const total = Math.max(Math.min(content.visitsNeeded, 12), 1); // más de 12 sellos ya no entra con un tamaño legible
  const columns = Math.max(Math.min(total, 5), 1);
  const rows = Math.ceil(total / columns);
  const colSpacing = usableWidth / columns;
  const iconRadius = Math.min(colSpacing * 0.26, 29 * scale);
  const rowSpacing = iconRadius * 2.25;
  const gridTop = logoTop + logoDiameter + 18 * scale;
  const firstRowCenterY = gridTop + iconRadius;

  let stampIcons = "";
  for (let i = 0; i < total; i++) {
    const row = Math.floor(i / columns);
    const col = i % columns;
    const itemsInRow = row === rows - 1 ? total - columns * (rows - 1) : columns;
    const rowOffset = (usableWidth - itemsInRow * colSpacing) / 2;
    const cx = sideMargin + rowOffset + colSpacing * (col + 0.5);
    const cy = firstRowCenterY + rowSpacing * row;
    const filled = i < content.stamps;

    if (filled) {
      stampIcons += `<circle cx="${cx}" cy="${cy}" r="${iconRadius}" fill="none" stroke="${textColor}" stroke-width="${4 * scale}" />`;
      stampIcons += `<path d="${checkmarkPath(cx, cy, iconRadius)}" fill="none" stroke="${textColor}" stroke-width="${5 * scale}" stroke-linecap="round" stroke-linejoin="round" />`;
    } else {
      stampIcons += `<circle cx="${cx}" cy="${cy}" r="${iconRadius}" fill="none" stroke="${textColor}" stroke-width="${3.5 * scale}" opacity="0.35" />`;
    }
  }

  const lastRowBottom = firstRowCenterY + rowSpacing * (rows - 1) + iconRadius;
  const labelFontSize = 27 * scale;
  const labelY = Math.min(lastRowBottom + labelFontSize * 1.25, height - 16 * scale);

  const svg = `
    <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
      <rect width="${width}" height="${height}" fill="${bgColor}" />
      <text x="${width - sideMargin}" y="${nameY}" text-anchor="end" font-family="DejaVu Sans"
            font-size="${nameFontSize}" font-weight="bold" fill="${textColor}">${escapeXml(content.tenantName)}</text>
      ${stampIcons}
      <text x="${width / 2}" y="${labelY}" text-anchor="middle" font-family="DejaVu Sans"
            font-size="${labelFontSize}" font-weight="bold" fill="${textColor}" opacity="0.95">${escapeXml(content.remainingLabel)}</text>
    </svg>
  `;

  return Buffer.from(svg);
}

// Recorta el logo a un círculo (coincide con el badge circular del
// diseño de referencia). Se hace con una máscara SVG + blend
// "dest-in" en vez de border-radius CSS porque estamos component-
// iendo con sharp directamente, no en un navegador.
async function circularLogo(logo: Buffer, diameter: number): Promise<Buffer> {
  const size = Math.round(diameter);
  const resized = await sharp(logo).resize(size, size, { fit: "cover" }).toBuffer();
  const mask = Buffer.from(`<svg><circle cx="${size / 2}" cy="${size / 2}" r="${size / 2}" fill="#fff"/></svg>`);
  return sharp(resized).composite([{ input: mask, blend: "dest-in" }]).png().toBuffer();
}

// El campo de logo normal (a diferencia del dedicado a Wallet) acepta
// cualquier tipo de imagen, SVG incluido — y un SVG es, en el fondo,
// texto XML que el propio negocio (o su diseñador) pudo haber
// exportado con Illustrator, Figma, Canva, etc. Cualquier detalle
// raro de esa exportación (una etiqueta mal cerrada, algo que ese
// programa considera válido pero no lo es estrictamente) hace que el
// parser XML que usa sharp por dentro (glib) rompa con un error real
// al intentar redimensionarlo — esto fue justo lo que le pasó a uno
// de los negocios, y no tiene nada que ver con el SVG que este mismo
// archivo genera para el diseño del pase.
function looksLikeSvg(buffer: Buffer): boolean {
  // No alcanza con mirar si el archivo EMPIEZA con "<svg" — muchos
  // exportadores (Illustrator entre ellos) anteponen un comentario
  // ("<!-- Generator: Adobe Illustrator ... -->") o un DOCTYPE antes
  // de la etiqueta svg real. Se busca la marca en cualquier parte de
  // los primeros bytes, no solo al principio exacto.
  const head = buffer.subarray(0, 512).toString("utf-8").toLowerCase();
  return head.includes("<svg") || head.includes("<?xml");
}

// Baja el logo UNA sola vez a su tamaño natural, respetando su propia
// transparencia — se reutiliza para las 3 densidades, redimensionando
// nada más que el tamaño final de composición en cada una.
async function fetchLogoBuffer(logoUrl: string): Promise<Buffer | null> {
  try {
    const res = await fetch(logoUrl);
    if (!res.ok) return null;
    // Chequeo barato antes de leer el archivo entero — si el propio
    // servidor ya dice que es SVG, ni hace falta mirar el contenido.
    if ((res.headers.get("content-type") || "").toLowerCase().includes("svg")) return null;
    const buffer = Buffer.from(await res.arrayBuffer());
    // Mejor un pase sin logo que un pase que ni se genera porque el
    // SVG subido tiene algún detalle que rompe el parser.
    if (looksLikeSvg(buffer)) return null;
    return buffer;
  } catch {
    return null;
  }
}

// Un respaldo mínimo — sin nombre, sin sellos, solo el color de
// fondo — para cuando ni siquiera el SVG base se puede generar. Esto
// nunca debería usarse en la práctica, pero es preferible entregar
// ALGO (un pase liso) a que la generación entera falle y el cliente
// se quede sin poder agregar su tarjeta a Wallet.
function buildFallbackSvg(bgColorHex: string, width: number, height: number): Buffer {
  const bgColor = sanitizeHexColor(bgColorHex, "#E7FF00");
  return Buffer.from(`<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg"><rect width="${width}" height="${height}" fill="${bgColor}"/></svg>`);
}

async function buildStrip(content: StripContent, width: number, height: number, logo: Buffer | null): Promise<Buffer> {
  let base: sharp.Sharp;
  try {
    base = sharp(buildBaseSvg(content, width, height));
    // sharp no valida el SVG hasta que se ejecuta de verdad — se
    // fuerza acá para detectar un SVG roto ANTES de intentar
    // componer el logo encima, en vez de que el error aparezca recién
    // más adelante mezclado con el resto del proceso.
    await sharp(buildBaseSvg(content, width, height)).png().toBuffer();
  } catch (err) {
    // Si esto pasa, algo en buildBaseSvg produjo un SVG inválido para
    // ESTOS datos puntuales — se deja registrado completo para poder
    // diagnosticar la próxima vez que ocurra, en vez de perder la
    // información apenas se cae en el respaldo.
    console.error(
      "buildBaseSvg produjo un SVG inválido — usando respaldo mínimo. Datos:",
      JSON.stringify({ tenantName: content.tenantName, backgroundColorHex: content.backgroundColorHex, textColorHex: content.textColorHex, stamps: content.stamps, visitsNeeded: content.visitsNeeded, remainingLabel: content.remainingLabel, width, height }),
      "Error:",
      err instanceof Error ? err.message : err,
      "SVG generado:",
      buildBaseSvg(content, width, height).toString("utf-8")
    );
    base = sharp(buildFallbackSvg(content.backgroundColorHex, width, height));
  }

  if (!logo) return base.png().toBuffer();

  // Estas medidas tienen que coincidir exactamente con logoDiameter/
  // logoLeft/logoTop usadas dentro de buildBaseSvg para el layout del
  // nombre del negocio (si se desalinean, el nombre queda calculado
  // para un logo que no es el que termina componiéndose).
  const scale = width / 1125;
  const logoDiameter = 112 * scale;
  const left = Math.round(45 * scale);
  const top = Math.round(24 * scale);

  try {
    const circular = await circularLogo(logo, logoDiameter);
    return base.composite([{ input: circular, left, top }]).png().toBuffer();
  } catch (err) {
    // Si el logo no se puede procesar (formato raro, corrupto, etc.),
    // el pase igual se genera sin él — mejor sin logo que sin pase.
    console.error(
      "No se pudo componer el logo sobre el strip — se genera sin él. Error:",
      err instanceof Error ? err.message : err
    );
    return base.png().toBuffer();
  }
}

async function buildImageBuffers(content: StripContent): Promise<Record<string, Buffer>> {
  const clean = content.backgroundColorHex.replace("#", "");
  const bg = {
    r: parseInt(clean.substring(0, 2), 16),
    g: parseInt(clean.substring(2, 4), 16),
    b: parseInt(clean.substring(4, 6), 16),
    alpha: 1,
  };

  const logo = content.logoUrl ? await fetchLogoBuffer(content.logoUrl) : null;

  const [strip1x, strip2x, strip3x] = await Promise.all([
    buildStrip(content, 375, 123, logo),
    buildStrip(content, 750, 246, logo),
    buildStrip(content, 1125, 369, logo),
  ]);

  async function buildIcon(size: number): Promise<Buffer> {
    if (!logo) return sharp({ create: { width: size, height: size, channels: 4, background: bg } }).png().toBuffer();
    try {
      return sharp(logo).resize(size, size, { fit: "cover" }).png().toBuffer();
    } catch {
      return sharp({ create: { width: size, height: size, channels: 4, background: bg } }).png().toBuffer();
    }
  }

  const [icon1x, icon2x, icon3x] = await Promise.all([buildIcon(29), buildIcon(58), buildIcon(87)]);

  return {
    "strip.png": strip1x,
    "strip@2x.png": strip2x,
    "strip@3x.png": strip3x,
    "icon.png": icon1x,
    "icon@2x.png": icon2x,
    "icon@3x.png": icon3x,
  };
}

export async function generateLoyaltyPass(card: LoyaltyCardData, tenant: TenantBrandData): Promise<Buffer> {
  if (!isApplePassConfigured()) {
    throw new Error("Apple Wallet no está configurado — faltan variables de entorno");
  }

  const wwdr = Buffer.from(process.env.APPLE_WWDR_CERT_BASE64!, "base64");
  const signerCert = Buffer.from(process.env.APPLE_PASS_SIGNER_CERT_BASE64!, "base64");
  const signerKey = Buffer.from(process.env.APPLE_PASS_SIGNER_KEY_BASE64!, "base64");

  const remaining = Math.max(tenant.loyaltyVisitsNeeded - card.stamps, 0);
  const remainingLabel =
    remaining === 0
      ? "¡Completaste tus sellos!"
      : `Te ${remaining === 1 ? "falta" : "faltan"} ${remaining} ${remaining === 1 ? "sello" : "sellos"} más`;

  const imageBuffers = await buildImageBuffers({
    tenantName: tenant.name,
    logoUrl: tenant.walletLogoUrl || tenant.logoUrl,
    backgroundColorHex: tenant.buttonColor,
    textColorHex: tenant.themeTextColor,
    stamps: card.stamps,
    visitsNeeded: tenant.loyaltyVisitsNeeded,
    remainingLabel,
  });

  const passJson = {
    formatVersion: 1,
    passTypeIdentifier: process.env.APPLE_PASS_TYPE_IDENTIFIER,
    teamIdentifier: process.env.APPLE_TEAM_IDENTIFIER,
    serialNumber: card.id,
    webServiceURL: `${process.env.NEXT_PUBLIC_SITE_URL || "https://zertoo.app"}/api/public/wallet/apple`,
    authenticationToken: authTokenFor(card.id),
    organizationName: tenant.name,
    description: `${tenant.name} — tarjeta de sellos`,
    foregroundColor: hexToRgb(tenant.themeTextColor),
    backgroundColor: hexToRgb(tenant.buttonColor),
    barcodes: [{ message: card.id, format: "PKBarcodeFormatQR", messageEncoding: "iso-8859-1" }],
    storeCard: {
      // El diseño visible en sí ya está compuesto en el strip.png —
      // este campo queda solo como respaldo de accesibilidad (lo que
      // lee VoiceOver, y lo que se ve en vistas compactas donde Apple
      // no muestra la imagen del strip).
      //
      // Va en secondaryFields y NO en primaryFields a propósito: en
      // un storeCard, Apple dibuja los primaryFields como texto
      // grande SUPERPUESTO sobre la propia imagen del strip (así se
      // veía el "1/10" + "SELLOS" enorme tapando el diseño en la
      // captura reportada). Los secondaryFields, en cambio, se
      // muestran en una fila aparte debajo del strip, sin pisar el
      // diseño — logran el mismo respaldo de accesibilidad sin
      // duplicar visualmente lo que el strip ya muestra.
      secondaryFields: [
        {
          key: "stamps",
          label: "SELLOS",
          value: `${card.stamps} / ${tenant.loyaltyVisitsNeeded}`,
        },
      ],
      backFields: [
        ...(card.customerName ? [{ key: "customerName", label: "Cliente", value: card.customerName }] : []),
        { key: "reward", label: "Premio al completar", value: tenant.loyaltyReward },
      ],
    },
  };

  const pass = new PKPass(
    {
      "pass.json": Buffer.from(JSON.stringify(passJson)),
      ...imageBuffers,
    },
    {
      wwdr,
      signerCert,
      signerKey,
      signerKeyPassphrase: process.env.APPLE_PASS_SIGNER_KEY_PASSPHRASE || undefined,
    }
  );

  return pass.getAsBuffer();
}

export { isApplePassConfigured };
