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

function escapeXml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");
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

// Fondo, nombre del negocio y sellos — TODO lo que se puede dibujar
// con formas y texto plano. El logo se deja afuera a propósito: antes
// se insertaba como imagen incrustada dentro del propio texto del
// SVG, y ese camino (SVG → PNG vía librsvg, la librería que usa sharp
// por dentro) no respeta bien la transparencia de imágenes
// incrustadas así — el resultado terminaba con fondo negro en vez de
// transparente. Componer el logo aparte, con sharp.composite(),
// evita ese problema de raíz porque usa un camino distinto que sí
// respeta el canal alfa correctamente.
function buildBaseSvg(content: StripContent, width: number, height: number): Buffer {
  const scale = width / 1125; // todas las medidas están pensadas para el ancho @3x, y se escalan para 1x/2x

  const maxIcons = Math.min(content.visitsNeeded, 12); // más de 12 en una fila se vería amontonado
  const sideMargin = 80 * scale;
  const usableWidth = width - sideMargin * 2;
  const spacing = usableWidth / maxIcons;
  const radius = Math.min(spacing * 0.32, 46 * scale);
  const iconsY = 210 * scale;

  let stampIcons = "";
  for (let i = 0; i < maxIcons; i++) {
    const cx = sideMargin + spacing * (i + 0.5);
    const filled = i < content.stamps;
    stampIcons += filled
      ? `<circle cx="${cx}" cy="${iconsY}" r="${radius}" fill="${content.textColorHex}" />`
      : `<circle cx="${cx}" cy="${iconsY}" r="${radius}" fill="none" stroke="${content.textColorHex}" stroke-width="${4 * scale}" opacity="0.4" />`;
  }

  const svg = `
    <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
      <rect width="${width}" height="${height}" fill="${content.backgroundColorHex}" />
      <text x="${width - 36 * scale}" y="${100 * scale}" text-anchor="end" font-family="DejaVu Sans"
            font-size="${52 * scale}" font-weight="bold" fill="${content.textColorHex}">${escapeXml(content.tenantName)}</text>
      ${stampIcons}
      <text x="${width / 2}" y="${320 * scale}" text-anchor="middle" font-family="DejaVu Sans"
            font-size="${34 * scale}" fill="${content.textColorHex}" opacity="0.85">${escapeXml(content.remainingLabel)}</text>
    </svg>
  `;

  return Buffer.from(svg);
}

// Baja el logo UNA sola vez a su tamaño natural, respetando su propia
// transparencia — se reutiliza para las 3 densidades, redimensionando
// nada más que el tamaño final de composición en cada una.
async function fetchLogoBuffer(logoUrl: string): Promise<Buffer | null> {
  try {
    const res = await fetch(logoUrl);
    if (!res.ok) return null;
    return Buffer.from(await res.arrayBuffer());
  } catch {
    return null;
  }
}

async function buildStrip(content: StripContent, width: number, height: number, logo: Buffer | null): Promise<Buffer> {
  const base = sharp(buildBaseSvg(content, width, height));
  if (!logo) return base.png().toBuffer();

  const scale = width / 1125;
  const logoWidth = Math.round(180 * scale);
  const logoHeight = Math.round(120 * scale);
  const left = Math.round(36 * scale);
  const top = Math.round(36 * scale);

  try {
    const resizedLogo = await sharp(logo)
      .resize({ width: logoWidth, height: logoHeight, fit: "inside", withoutEnlargement: true })
      .toBuffer();
    return base.composite([{ input: resizedLogo, left, top }]).png().toBuffer();
  } catch {
    // Si el logo no se puede procesar (formato raro, corrupto, etc.),
    // el pase igual se genera sin él — mejor sin logo que sin pase.
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
      primaryFields: [
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
