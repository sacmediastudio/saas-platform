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

// Genera las imágenes del pase — un ícono chico (obligatorio, uso
// interno de Apple en notificaciones, nunca se ve prominente) y un
// "strip" (el banner ancho que sí se ve, con el color de marca del
// negocio de fondo y el logo compuesto arriba). Componer el logo
// sobre un fondo SÓLIDO en vez de dejarlo suelto sobre transparencia
// evita el problema del "cuadro blanco": si el logo original tiene su
// propio fondo blanco, ese blanco va a quedar ahí de cualquier forma,
// pero al menos queda dentro de un diseño intencional, no flotando
// solo en una esquina.
async function buildImageBuffers(logoUrl: string | null, brandColorHex: string): Promise<Record<string, Buffer>> {
  const clean = brandColorHex.replace("#", "");
  const bg = {
    r: parseInt(clean.substring(0, 2), 16),
    g: parseInt(clean.substring(2, 4), 16),
    b: parseInt(clean.substring(4, 6), 16),
    alpha: 1,
  };

  async function buildStrip(width: number, height: number): Promise<Buffer> {
    const base = sharp({ create: { width, height, channels: 4, background: bg } });
    if (!logoUrl) return base.png().toBuffer();
    try {
      const res = await fetch(logoUrl);
      if (!res.ok) return base.png().toBuffer();
      const original = Buffer.from(await res.arrayBuffer());
      // El logo ocupa como el 55% de la altura del banner, centrado —
      // deja aire arriba y abajo en vez de estirarse de punta a punta.
      const logoHeight = Math.round(height * 0.55);
      const logo = await sharp(original)
        .resize({ height: logoHeight, fit: "inside", withoutEnlargement: true })
        .toBuffer();
      const logoMeta = await sharp(logo).metadata();
      const left = Math.max(0, Math.round((width - (logoMeta.width ?? 0)) / 2));
      const top = Math.round((height - logoHeight) / 2);
      return base.composite([{ input: logo, left, top }]).png().toBuffer();
    } catch {
      return base.png().toBuffer();
    }
  }

  async function buildIcon(size: number): Promise<Buffer> {
    if (!logoUrl) return sharp({ create: { width: size, height: size, channels: 4, background: bg } }).png().toBuffer();
    try {
      const res = await fetch(logoUrl);
      if (!res.ok) throw new Error("logo no disponible");
      const original = Buffer.from(await res.arrayBuffer());
      return sharp(original).resize(size, size, { fit: "cover" }).png().toBuffer();
    } catch {
      return sharp({ create: { width: size, height: size, channels: 4, background: bg } }).png().toBuffer();
    }
  }

  const [strip1x, strip2x, strip3x, icon1x, icon2x, icon3x] = await Promise.all([
    buildStrip(375, 123),
    buildStrip(750, 246),
    buildStrip(1125, 369),
    buildIcon(29),
    buildIcon(58),
    buildIcon(87),
  ]);

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

  const imageBuffers = await buildImageBuffers(tenant.logoUrl, tenant.buttonColor);

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
