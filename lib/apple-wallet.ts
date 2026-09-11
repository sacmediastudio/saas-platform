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

// Baja una imagen y la devuelve como "data URI" en base64, lista para
// insertar directo dentro de un <image> de SVG — así el SVG queda
// autocontenido, sin depender de que sharp salga a buscar la imagen
// por su cuenta durante la conversión a PNG.
async function fetchAsDataUri(url: string): Promise<string | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const buffer = Buffer.from(await res.arrayBuffer());
    const contentType = res.headers.get("content-type") || "image/png";
    return `data:${contentType};base64,${buffer.toString("base64")}`;
  } catch {
    return null;
  }
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

// Compone TODO el diseño visible del pase como una sola imagen — en
// vez de depender de los campos de texto de Apple (que no permiten
// elegir negrita, alineación, ni dibujar íconos de sello reales), se
// dibuja a mano con SVG: el logo, el nombre del negocio en negrita a
// la derecha, los sellos como círculos llenos/vacíos (mismo criterio
// visual que la versión web), y cuánto falta para el premio.
// Se compone una sola vez a la resolución más alta (@3x) y se achica
// para las otras 2 densidades, para que las 3 se vean idénticas entre
// sí — dibujar 3 veces por separado arriesgaría que no coincidan.
async function buildStripSvg(content: StripContent): Promise<Buffer> {
  const W = 1125;
  const H = 369;

  const logoDataUri = content.logoUrl ? await fetchAsDataUri(content.logoUrl) : null;
  const logoBlock = logoDataUri
    ? `<image x="36" y="36" width="180" height="120" href="${logoDataUri}" preserveAspectRatio="xMidYMid meet" />`
    : "";

  // Los sellos van en una fila pareja, con margen a los costados —
  // llenos (color de marca) para los que ya tiene, solo el contorno
  // para los que faltan.
  const maxIcons = Math.min(content.visitsNeeded, 12); // más de 12 en una fila se vería amontonado
  const sideMargin = 80;
  const usableWidth = W - sideMargin * 2;
  const spacing = usableWidth / maxIcons;
  const radius = Math.min(spacing * 0.32, 46);
  const iconsY = 210;

  let stampIcons = "";
  for (let i = 0; i < maxIcons; i++) {
    const cx = sideMargin + spacing * (i + 0.5);
    const filled = i < content.stamps;
    stampIcons += filled
      ? `<circle cx="${cx}" cy="${iconsY}" r="${radius}" fill="${content.textColorHex}" />`
      : `<circle cx="${cx}" cy="${iconsY}" r="${radius}" fill="none" stroke="${content.textColorHex}" stroke-width="4" opacity="0.4" />`;
  }

  const svg = `
    <svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">
      <rect width="${W}" height="${H}" fill="${content.backgroundColorHex}" />
      ${logoBlock}
      <text x="${W - 36}" y="100" text-anchor="end" font-family="Helvetica, Arial, sans-serif"
            font-size="52" font-weight="bold" fill="${content.textColorHex}">${escapeXml(content.tenantName)}</text>
      ${stampIcons}
      <text x="${W / 2}" y="320" text-anchor="middle" font-family="Helvetica, Arial, sans-serif"
            font-size="34" fill="${content.textColorHex}" opacity="0.85">${escapeXml(content.remainingLabel)}</text>
    </svg>
  `;

  return sharp(Buffer.from(svg)).png().toBuffer();
}

async function buildImageBuffers(content: StripContent): Promise<Record<string, Buffer>> {
  const clean = content.backgroundColorHex.replace("#", "");
  const bg = {
    r: parseInt(clean.substring(0, 2), 16),
    g: parseInt(clean.substring(2, 4), 16),
    b: parseInt(clean.substring(4, 6), 16),
    alpha: 1,
  };

  const strip3x = await buildStripSvg(content);
  const [strip1x, strip2x] = await Promise.all([
    sharp(strip3x).resize(375, 123).png().toBuffer(),
    sharp(strip3x).resize(750, 246).png().toBuffer(),
  ]);

  async function buildIcon(size: number): Promise<Buffer> {
    if (!content.logoUrl) return sharp({ create: { width: size, height: size, channels: 4, background: bg } }).png().toBuffer();
    try {
      const res = await fetch(content.logoUrl);
      if (!res.ok) throw new Error("logo no disponible");
      const original = Buffer.from(await res.arrayBuffer());
      return sharp(original).resize(size, size, { fit: "cover" }).png().toBuffer();
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
