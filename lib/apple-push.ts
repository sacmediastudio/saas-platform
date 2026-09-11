import http2 from "http2";
import jwt from "jsonwebtoken";
import { db } from "./db";

let cachedToken: { value: string; issuedAt: number } | null = null;

// El token de autenticación de APNs sirve por un buen rato — se
// reutiliza en vez de firmar uno nuevo en cada push, pero se renueva
// solo si ya pasaron más de 50 minutos (Apple los acepta hasta 60).
function getApnsToken(): string {
  if (cachedToken && Date.now() - cachedToken.issuedAt < 50 * 60 * 1000) return cachedToken.value;

  const key = Buffer.from(process.env.APPLE_APNS_KEY_BASE64!, "base64").toString("utf-8");
  const value = jwt.sign({ iss: process.env.APPLE_TEAM_IDENTIFIER, iat: Math.floor(Date.now() / 1000) }, key, {
    algorithm: "ES256",
    header: { alg: "ES256", kid: process.env.APPLE_APNS_KEY_ID! },
  });
  cachedToken = { value, issuedAt: Date.now() };
  return value;
}

function isApnsConfigured(): boolean {
  return Boolean(process.env.APPLE_APNS_KEY_BASE64 && process.env.APPLE_APNS_KEY_ID && process.env.APPLE_TEAM_IDENTIFIER);
}

// Manda un único push "de fondo" (sin contenido visible, sin sonido)
// que le dice al dispositivo "el pase X cambió, andá a buscarlo de
// nuevo" — el propio protocolo de PassKit interpreta cualquier push
// al topic de un pase como ese aviso, no hace falta un formato
// especial de contenido.
function sendSinglePush(pushToken: string): Promise<void> {
  return new Promise((resolve) => {
    const client = http2.connect("https://api.push.apple.com");
    client.on("error", () => resolve());

    const req = client.request({
      ":method": "POST",
      ":path": `/3/device/${pushToken}`,
      authorization: `bearer ${getApnsToken()}`,
      "apns-topic": process.env.APPLE_PASS_TYPE_IDENTIFIER!,
      "apns-push-type": "background",
      "apns-priority": "5",
    });

    req.write(JSON.stringify({}));
    req.end();
    req.on("response", () => {}); // no hace falta leer el resultado para seguir
    req.on("close", () => {
      client.close();
      resolve();
    });
  });
}

// Se llama cada vez que se suma un sello — le avisa a TODOS los
// dispositivos que tengan este pase agregado (puede ser más de uno,
// si el cliente lo agregó desde 2 teléfonos distintos).
export async function notifyPassUpdated(loyaltyCardId: string): Promise<void> {
  if (!isApnsConfigured()) return; // Apple Wallet ni configurado — nada que avisar

  const registrations = await db.walletDeviceRegistration.findMany({
    where: { loyaltyCardId },
    select: { pushToken: true },
  });
  await Promise.all(registrations.map((r) => sendSinglePush(r.pushToken)));
}
