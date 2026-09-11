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

// Baja el logo del negocio y lo redimensiona a los tamaños EXACTOS
// que Apple exige para cada densidad de pantalla — el logo que se
// sube en Ajustes puede ser de cualquier tamaño/proporción, así que
// no alcanza con usarlo tal cual.
async function buildLogoBuffers(logoUrl: string | null): Promise<Record<string, Buffer>> {
  if (!logoUrl) return {};
  try {
    const res = await fetch(logoUrl);
    if (!res.ok) return {};
    const original = Buffer.from(await res.arrayBuffer());
    const [logo1x, logo2x, logo3x, icon1x, icon2x, icon3x] = await Promise.all([
      sharp(original).resize(160, 50, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toBuffer(),
      sharp(original).resize(320, 100, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toBuffer(),
      sharp(original).resize(480, 150, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toBuffer(),
      sharp(original).resize(29, 29).png().toBuffer(),
      sharp(original).resize(58, 58).png().toBuffer(),
      sharp(original).resize(87, 87).png().toBuffer(),
    ]);
    return {
      "logo.png": logo1x,
      "logo@2x.png": logo2x,
      "logo@3x.png": logo3x,
      "icon.png": icon1x,
      "icon@2x.png": icon2x,
      "icon@3x.png": icon3x,
    };
  } catch {
    // Si el logo no se pudo bajar/procesar, el pase igual se genera
    // sin él — mejor un pase sin logo que ningún pase.
    return {};
  }
}

export async function generateLoyaltyPass(card: LoyaltyCardData, tenant: TenantBrandData): Promise<Buffer> {
  if (!isApplePassConfigured()) {
    throw new Error("Apple Wallet no está configurado — faltan variables de entorno");
  }

  const wwdr = Buffer.from(process.env.APPLE_WWDR_CERT_BASE64!, "base64");
  const signerCert = Buffer.from(process.env.APPLE_PASS_SIGNER_CERT_BASE64!, "base64");
  const signerKey = Buffer.from(process.env.APPLE_PASS_SIGNER_KEY_BASE64!, "base64");

  const logoBuffers = await buildLogoBuffers(tenant.logoUrl);

  const passJson = {
    formatVersion: 1,
    passTypeIdentifier: process.env.APPLE_PASS_TYPE_IDENTIFIER,
    teamIdentifier: process.env.APPLE_TEAM_IDENTIFIER,
    serialNumber: card.id,
    webServiceURL: `${process.env.NEXT_PUBLIC_SITE_URL || "https://zertoo.app"}/api/public/wallet/apple`,
    authenticationToken: authTokenFor(card.id),
    organizationName: tenant.name,
    description: `${tenant.name} — tarjeta de sellos`,
    logoText: tenant.name,
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
      secondaryFields: card.customerName
        ? [{ key: "customerName", label: "CLIENTE", value: card.customerName }]
        : [],
      backFields: [{ key: "reward", label: "Premio al completar", value: tenant.loyaltyReward }],
    },
  };

  const pass = new PKPass(
    {
      "pass.json": Buffer.from(JSON.stringify(passJson)),
      ...logoBuffers,
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
