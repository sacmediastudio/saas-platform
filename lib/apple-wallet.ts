import crypto from "crypto";
import sharp from "sharp";
import { PKPass } from "passkit-generator";
import { textToPath, measureTextWidth } from "./text-to-path";

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

// Los textos vienen de datos del negocio (nombre) o generados por el
// propio código (el de "cuántos faltan") — de cualquier forma, se
// limpian caracteres de control antes de convertirlos a trazos, por
// si alguno se coló al copiar/pegar desde Word, un PDF, etc.
function stripIllegalXmlChars(s: string): string {
  // eslint-disable-next-line no-control-regex
  return s.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, "");
}

// Números en JavaScript pueden convertirse a texto con precisión
// excesiva (183.00000000000003) o notación científica para valores
// muy chicos — nada de esto rompería XML por sí solo, pero como no se
// pudo reproducir el error con los datos exactos que sí fallan en
// producción, se redondea todo por las dudas: es una limpieza sin
// costo real que descarta esa clase entera de sospechosos.
function num(n: number): string {
  return Number.isFinite(n) ? n.toFixed(2) : "0";
}

interface StripContent {
  tenantName: string;
  logoUrl: string | null;
  stamps: number;
  visitsNeeded: number;
  remainingLabel: string;
}

// Plantilla única para todos los negocios — colores fijos, ya no
// configurables por tenant. Se decidió así después de no poder
// reproducir, pese a mucho esfuerzo, la causa exacta de un error de
// XML que solo aparecía con los colores dinámicos de un negocio en
// particular; quitar esa variable de la ecuación por completo es más
// confiable que seguir buscando la causa exacta.
const BG_COLOR = "#e4f73e";
const TEXT_COLOR = "#0a2808";
const STAMP_ACTIVE_COLOR = "#dd5152";
const STAMP_INACTIVE_COLOR = "#c0d8bf";

// El path real del ícono "Stamp" de Lucide (la misma librería que ya
// usa la versión web) — copiado tal cual de su definición oficial,
// en su sistema de coordenadas nativo de 24x24. Se posiciona y
// escala con un <g transform="...">, no recalculando cada punto a
// mano, para no arriesgarse a introducir un error de transcripción.
const STAMP_ICON_PATHS = [
  "M14 13V8.5C14 7 15 7 15 5a3 3 0 0 0-6 0c0 2 1 2 1 3.5V13",
  "M20 15.5a2.5 2.5 0 0 0-2.5-2.5h-11A2.5 2.5 0 0 0 4 15.5V17a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1z",
  "M5 22h14",
];

function stampIconGroup(cx: number, cy: number, size: number, color: string): string {
  const s = size / 24;
  const tx = cx - size / 2;
  const ty = cy - size / 2;
  const paths = STAMP_ICON_PATHS.map((d) => `<path d="${d}" />`).join("");
  return `<g transform="translate(${num(tx)}, ${num(ty)}) scale(${num(s)})" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${paths}</g>`;
}

// Fondo, nombre del negocio y sellos — TODO lo que se puede dibujar
// con formas y trazos. El logo se compone aparte (ver buildStrip),
// porque necesita respetar su propia transparencia — algo que
// insertarlo como imagen dentro del texto del SVG no lograba hacer
// bien.
//
// El nombre y el texto de "cuántos faltan" se dibujan como trazos
// (con textToPath), no como elementos <text> — evita depender de que
// el servidor tenga alguna fuente instalada, que resultó no ser
// confiable en Railway pese a varios intentos.
//
// Filas de sellos: 7 o menos entran en una sola fila; 8 o más se
// reparten en 2 filas parejas (ej. 8 → 4+4, 12 → 6+6).
function buildBaseSvg(content: StripContent, width: number, height: number): Buffer {
  const scale = width / 1125; // todas las medidas están pensadas para el ancho @3x, y se escalan para 1x/2x
  // Márgenes separados: más generoso a los costados (pedido explícito
  // de "que no se vea pegado a los lados", y el nombre se cortaba
  // justo ahí), más moderado arriba/abajo porque el alto del strip es
  // angosto y ya está ajustado para que la grilla de sellos entre sin
  // pisar el texto de abajo.
  const marginX = 110 * scale;
  const marginY = 42 * scale;
  const tenantName = stripIllegalXmlChars(content.tenantName);
  const remainingLabel = stripIllegalXmlChars(content.remainingLabel);

  const logoBoxWidth = 280 * scale;
  const logoBoxHeight = 100 * scale;
  const logoTop = marginY;
  const logoCenterY = logoTop + logoBoxHeight / 2;

  // Nombre del negocio, alineado verticalmente con el logo. El
  // tamaño se reduce para nombres largos para que el texto nunca
  // invada el logo — ahora medido con el ancho real de la fuente
  // (textToPath/measureTextWidth), no una aproximación.
  const baseNameFontSize = 52 * scale;
  const minNameFontSize = 26 * scale;
  const nameLeftBoundary = marginX + logoBoxWidth + 28 * scale;
  const maxNameWidth = width - marginX - nameLeftBoundary;
  let nameFontSize = baseNameFontSize;
  while (nameFontSize > minNameFontSize && measureTextWidth(tenantName, nameFontSize) > maxNameWidth) {
    nameFontSize -= 2 * scale;
  }
  const nameWidth = measureTextWidth(tenantName, nameFontSize);
  const nameX = width - marginX - nameWidth;
  const nameY = logoCenterY + nameFontSize * 0.35;
  const namePath = textToPath(tenantName, nameX, nameY, nameFontSize).pathData;

  // El tamaño del sello ahora es FIJO según la cantidad de filas (ya
  // no depende de cuánto espacio quede por columna) — antes, al ir
  // agregando sellos a una misma fila, colSpacing se reducía y con
  // él el tamaño del ícono, dando la sensación de que "se achicaban"
  // a medida que se sumaban más. Ahora el tamaño se mantiene
  // constante, y lo que varía es el espacio entre columnas.
  const usableWidth = width - marginX * 2;
  const total = Math.max(Math.min(content.visitsNeeded, 14), 1); // más de 14 sellos ya no entra con un tamaño legible
  const rows = total <= 7 ? 1 : 2;
  const columns = Math.ceil(total / rows);
  const colSpacing = usableWidth / columns;
  const iconRadius = rows === 1 ? 52 * scale : 25 * scale;
  const rowSpacing = iconRadius * 2.2;
  const gridTop = logoTop + logoBoxHeight + 24 * scale;
  const firstRowCenterY = gridTop + iconRadius;

  let stampIcons = "";
  for (let i = 0; i < total; i++) {
    const row = Math.floor(i / columns);
    const col = i % columns;
    const itemsInRow = row === rows - 1 ? total - columns * (rows - 1) : columns;
    const rowOffset = (usableWidth - itemsInRow * colSpacing) / 2;
    const cx = marginX + rowOffset + colSpacing * (col + 0.5);
    const cy = firstRowCenterY + rowSpacing * row;
    const filled = i < content.stamps;
    const circleColor = filled ? STAMP_ACTIVE_COLOR : STAMP_INACTIVE_COLOR;
    const iconColor = filled ? BG_COLOR : "#ffffff";

    stampIcons += `<circle cx="${num(cx)}" cy="${num(cy)}" r="${num(iconRadius)}" fill="${circleColor}" />`;
    stampIcons += stampIconGroup(cx, cy, iconRadius * 1.15, iconColor);
  }

  const lastRowBottom = firstRowCenterY + rowSpacing * (rows - 1) + iconRadius;
  const labelFontSize = 26 * scale;
  const labelWidth = measureTextWidth(remainingLabel, labelFontSize);
  const labelX = (width - labelWidth) / 2;
  const labelY = Math.min(lastRowBottom + labelFontSize * 1.15, height - marginY);
  const labelPath = textToPath(remainingLabel, labelX, labelY, labelFontSize).pathData;

  const svg = `
    <svg width="${num(width)}" height="${num(height)}" xmlns="http://www.w3.org/2000/svg">
      <rect width="${num(width)}" height="${num(height)}" fill="${BG_COLOR}" />
      <path d="${namePath}" fill="${TEXT_COLOR}" />
      ${stampIcons}
      <path d="${labelPath}" fill="${TEXT_COLOR}" opacity="0.95" />
    </svg>
  `;

  return Buffer.from(svg);
}

// Redimensiona el logo para que entre en su caja disponible,
// preservando su propia forma y transparencia — a diferencia de la
// versión anterior, ya no se recorta a un círculo. "contain" deja
// aire (relleno transparente) en vez de recortar o estirar el logo
// para forzarlo a un tamaño exacto.
async function fitLogo(logo: Buffer, boxWidth: number, boxHeight: number): Promise<Buffer> {
  return sharp(logo)
    .resize(Math.round(boxWidth), Math.round(boxHeight), {
      fit: "contain",
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .png()
    .toBuffer();
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
function buildFallbackSvg(width: number, height: number): Buffer {
  return Buffer.from(`<svg width="${num(width)}" height="${num(height)}" xmlns="http://www.w3.org/2000/svg"><rect width="${num(width)}" height="${num(height)}" fill="${BG_COLOR}"/></svg>`);
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
      JSON.stringify({ tenantName: content.tenantName, stamps: content.stamps, visitsNeeded: content.visitsNeeded, remainingLabel: content.remainingLabel, width, height }),
      "Error:",
      err instanceof Error ? err.message : err,
      "SVG generado:",
      buildBaseSvg(content, width, height).toString("utf-8")
    );
    base = sharp(buildFallbackSvg(width, height));
  }

  if (!logo) return base.png().toBuffer();

  // Estas medidas tienen que coincidir exactamente con logoBoxWidth/
  // logoBoxHeight/marginX/marginY usadas dentro de buildBaseSvg para
  // el layout del nombre del negocio (si se desalinean, el nombre
  // queda calculado para un logo que no es el que termina
  // componiéndose).
  const scale = width / 1125;
  const marginX = 110 * scale;
  const marginY = 42 * scale;
  const logoBoxWidth = 280 * scale;
  const logoBoxHeight = 100 * scale;

  try {
    const fitted = await fitLogo(logo, logoBoxWidth, logoBoxHeight);
    return base
      .composite([{ input: fitted, left: Math.round(marginX), top: Math.round(marginY) }])
      .png()
      .toBuffer();
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
  const clean = BG_COLOR.replace("#", "");
  const bg = {
    r: parseInt(clean.substring(0, 2), 16),
    g: parseInt(clean.substring(2, 4), 16),
    b: parseInt(clean.substring(4, 6), 16),
    alpha: 1,
  };

  const logo = content.logoUrl ? await fetchLogoBuffer(content.logoUrl) : null;

  // Secuencial a propósito, no Promise.all: no se pudo confirmar la
  // causa exacta del error de XML pese a probar con los datos reales
  // que sí fallan en producción — correr las 3 conversiones de SVG a
  // PNG al mismo tiempo es un sospechoso razonable (una posible
  // interferencia a nivel de la librería nativa que usa sharp por
  // dentro), y evitarlo cuesta poco dado que esto no es una ruta de
  // alto tráfico.
  const strip1x = await buildStrip(content, 375, 123, logo);
  const strip2x = await buildStrip(content, 750, 246, logo);
  const strip3x = await buildStrip(content, 1125, 369, logo);

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
    foregroundColor: hexToRgb(TEXT_COLOR),
    backgroundColor: hexToRgb(BG_COLOR),
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
