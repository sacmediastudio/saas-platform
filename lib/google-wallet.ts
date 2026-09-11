import jwt from "jsonwebtoken";

const WALLET_API_BASE = "https://walletobjects.googleapis.com/walletobjects/v1";

function isGoogleWalletConfigured(): boolean {
  return Boolean(
    process.env.GOOGLE_WALLET_ISSUER_ID &&
      process.env.GOOGLE_WALLET_SERVICE_ACCOUNT_EMAIL &&
      process.env.GOOGLE_WALLET_PRIVATE_KEY_BASE64
  );
}

function getPrivateKey(): string {
  return Buffer.from(process.env.GOOGLE_WALLET_PRIVATE_KEY_BASE64!, "base64").toString("utf-8");
}

let cachedAccessToken: { value: string; expiresAt: number } | null = null;

// Intercambia el JWT de la cuenta de servicio por un token de acceso
// de verdad — se reutiliza mientras no esté vencido, en vez de pedir
// uno nuevo en cada llamada a la API.
async function getAccessToken(): Promise<string> {
  if (cachedAccessToken && Date.now() < cachedAccessToken.expiresAt) return cachedAccessToken.value;

  const now = Math.floor(Date.now() / 1000);
  const assertion = jwt.sign(
    {
      iss: process.env.GOOGLE_WALLET_SERVICE_ACCOUNT_EMAIL,
      scope: "https://www.googleapis.com/auth/wallet_object.issuer",
      aud: "https://oauth2.googleapis.com/token",
      iat: now,
      exp: now + 3600,
    },
    getPrivateKey(),
    { algorithm: "RS256" }
  );

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion,
    }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(`No se pudo autenticar con Google Wallet: ${JSON.stringify(data)}`);

  cachedAccessToken = { value: data.access_token, expiresAt: Date.now() + (data.expires_in - 60) * 1000 };
  return data.access_token;
}

interface TenantBrandData {
  id: string;
  name: string;
  logoUrl: string | null;
  buttonColor: string;
  themeTextColor: string;
  loyaltyVisitsNeeded: number;
  loyaltyReward: string;
}

function classIdFor(tenantId: string): string {
  return `${process.env.GOOGLE_WALLET_ISSUER_ID}.tenant_${tenantId}`;
}

function objectIdFor(loyaltyCardId: string): string {
  return `${process.env.GOOGLE_WALLET_ISSUER_ID}.card_${loyaltyCardId}`;
}

// Crea o actualiza la "clase" (la plantilla visual del negocio — un
// molde compartido por TODAS las tarjetas de ese negocio, no una por
// cliente). Se llama antes de crear el primer objeto, y de nuevo si
// el negocio cambia su marca — es más barato reintentar un "update"
// que consultar primero si existe.
async function ensureLoyaltyClass(tenant: TenantBrandData): Promise<void> {
  const accessToken = await getAccessToken();
  const classId = classIdFor(tenant.id);

  const classPayload = {
    id: classId,
    issuerName: tenant.name,
    programName: tenant.name,
    programLogo: tenant.logoUrl ? { sourceUri: { uri: tenant.logoUrl } } : undefined,
    hexBackgroundColor: tenant.buttonColor,
    reviewStatus: "UNDER_REVIEW",
  };

  const res = await fetch(`${WALLET_API_BASE}/loyaltyClass/${classId}`, {
    method: "PUT",
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify(classPayload),
  });

  if (res.status === 404) {
    // Todavía no existe — se crea por primera vez.
    await fetch(`${WALLET_API_BASE}/loyaltyClass`, {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
      body: JSON.stringify(classPayload),
    });
  }
}

interface LoyaltyCardData {
  id: string;
  customerName: string | null;
  stamps: number;
}

// Crea o actualiza el "objeto" — la tarjeta puntual de este cliente,
// con su conteo de sellos actual. Llamar de nuevo con datos nuevos
// ACTUALIZA la tarjeta que el cliente ya tiene guardada, sin que
// tenga que volver a agregarla — a diferencia de Apple, no hace
// falta ningún mecanismo de push aparte para esto.
export async function upsertLoyaltyObject(card: LoyaltyCardData, tenant: TenantBrandData): Promise<string> {
  if (!isGoogleWalletConfigured()) {
    throw new Error("Google Wallet no está configurado — faltan variables de entorno");
  }

  await ensureLoyaltyClass(tenant);
  const accessToken = await getAccessToken();
  const objectId = objectIdFor(card.id);

  const objectPayload = {
    id: objectId,
    classId: classIdFor(tenant.id),
    state: "ACTIVE",
    accountId: card.id,
    accountName: card.customerName || undefined,
    loyaltyPoints: {
      label: "Sellos",
      balance: { string: `${card.stamps} / ${tenant.loyaltyVisitsNeeded}` },
    },
    barcode: { type: "QR_CODE", value: card.id },
  };

  const res = await fetch(`${WALLET_API_BASE}/loyaltyObject/${objectId}`, {
    method: "PUT",
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify(objectPayload),
  });

  if (res.status === 404) {
    await fetch(`${WALLET_API_BASE}/loyaltyObject`, {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
      body: JSON.stringify(objectPayload),
    });
  }

  return objectId;
}

// El link "Agregar a Google Wallet" — a diferencia de Apple, no es un
// archivo para descargar, es un JWT firmado que Google reconoce.
export function buildSaveLink(objectId: string): string {
  const payload = {
    iss: process.env.GOOGLE_WALLET_SERVICE_ACCOUNT_EMAIL,
    aud: "google",
    typ: "savetowallet",
    iat: Math.floor(Date.now() / 1000),
    payload: { loyaltyObjects: [{ id: objectId }] },
  };
  const token = jwt.sign(payload, getPrivateKey(), { algorithm: "RS256" });
  return `https://pay.google.com/gp/v/save/${token}`;
}

export { isGoogleWalletConfigured };
