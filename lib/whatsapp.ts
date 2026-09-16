/**
 * Envía mensajes de WhatsApp usando Twilio (en vez de la API de Meta
 * directo, que usábamos antes) — Twilio actúa como intermediario ya
 * verificado ante Meta, lo que evita la demora de verificación propia
 * que tuvimos bloqueada por más de 2 semanas. La lógica de negocio
 * (qué plantilla usar, qué idioma, qué parámetros) es la misma de
 * siempre — lo único que cambió es CÓMO se arma y firma la llamada a
 * la API.
 *
 * Diferencias clave con la versión anterior (Meta directo):
 * - Autenticación: Account SID + Auth Token (Basic Auth), no un
 *   token Bearer.
 * - El cuerpo del pedido va como form-urlencoded, no JSON.
 * - Cada plantilla+idioma tiene su propio "Content SID" (empieza con
 *   HX...) en vez de un nombre de plantilla + código de idioma
 *   separados — Twilio genera un SID distinto por cada versión de
 *   idioma que armás en su Content Template Builder.
 * - El número de destino y el de origen llevan el prefijo
 *   "whatsapp:" antes del +código de país.
 */

const ACCOUNT_SID = process.env.TWILIO_ACCOUNT_SID;
const AUTH_TOKEN = process.env.TWILIO_AUTH_TOKEN;
const WHATSAPP_NUMBER = process.env.TWILIO_WHATSAPP_NUMBER; // formato: +18095551234, sin "whatsapp:"

const TEMPLATE_ES = process.env.TWILIO_TEMPLATE_BOOKING_REMINDER_ES || "";
const TEMPLATE_EN = process.env.TWILIO_TEMPLATE_BOOKING_REMINDER_EN || "";

const LEAD_TEMPLATE_ES = process.env.TWILIO_TEMPLATE_LEAD_REWARD_ES || "";
const LEAD_TEMPLATE_EN = process.env.TWILIO_TEMPLATE_LEAD_REWARD_EN || "";

const ORDER_CONFIRMATION_ES = process.env.TWILIO_TEMPLATE_ORDER_CONFIRMATION_ES || "";
const ORDER_CONFIRMATION_EN = process.env.TWILIO_TEMPLATE_ORDER_CONFIRMATION_EN || "";

const NEW_ORDER_ALERT_ES = process.env.TWILIO_TEMPLATE_NEW_ORDER_ALERT_ES || "";
const NEW_ORDER_ALERT_EN = process.env.TWILIO_TEMPLATE_NEW_ORDER_ALERT_EN || "";

export function isWhatsAppConfigured(): boolean {
  return Boolean(ACCOUNT_SID && AUTH_TOKEN && WHATSAPP_NUMBER);
}

/** Deja el número en formato E.164 (+código de país + número, sin espacios ni guiones). */
function normalizePhone(phone: string): string {
  const digits = phone.replace(/[^\d]/g, "");
  return digits.startsWith("+") ? digits : `+${digits}`;
}

/**
 * Función base: manda cualquier plantilla aprobada con sus parámetros
 * en orden — recibe el Content SID YA RESUELTO (cada función de más
 * abajo decide cuál es el correcto para SU plantilla e idioma).
 */
async function sendTemplateMessage(params: {
  toPhone: string;
  contentSid: string;
  bodyParams: string[];
}): Promise<void> {
  if (!isWhatsAppConfigured()) return;
  if (!params.contentSid) {
    throw new Error("Falta configurar el Content SID de esta plantilla en las variables de entorno");
  }

  // Twilio espera las variables como un objeto {"1": "...", "2": "..."}
  // convertido a texto — misma idea posicional que ya usábamos con
  // las variables {{1}}, {{2}} de Meta, solo que acá se arma a mano
  // en vez de que la API las tome de un array.
  const contentVariables: Record<string, string> = {};
  params.bodyParams.forEach((value, index) => {
    contentVariables[String(index + 1)] = value;
  });

  const body = new URLSearchParams({
    To: `whatsapp:${normalizePhone(params.toPhone)}`,
    From: `whatsapp:${WHATSAPP_NUMBER}`,
    ContentSid: params.contentSid,
    ContentVariables: JSON.stringify(contentVariables),
  });

  const auth = Buffer.from(`${ACCOUNT_SID}:${AUTH_TOKEN}`).toString("base64");

  const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${ACCOUNT_SID}/Messages.json`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${auth}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: body.toString(),
  });

  if (!res.ok) {
    const responseBody = await res.text().catch(() => "");
    throw new Error(`Twilio respondió ${res.status}: ${responseBody}`);
  }
}

/**
 * Manda el recordatorio de una cita usando la plantilla configurada.
 * Los parámetros se mandan en orden — deben coincidir exactamente con
 * las variables {{1}}, {{2}}, etc. que tenga la plantilla aprobada.
 */
export async function sendBookingReminder(params: {
  toPhone: string;
  customerName: string;
  serviceName: string;
  businessName: string;
  dateLabel: string;
  timeLabel: string;
  language: string;
}): Promise<void> {
  await sendTemplateMessage({
    toPhone: params.toPhone,
    contentSid: params.language === "en" ? TEMPLATE_EN : TEMPLATE_ES,
    bodyParams: [params.customerName, params.serviceName, params.dateLabel, params.timeLabel, params.businessName],
  });
}

/**
 * Manda el código de canje del premio del menú (ej. "Postre gratis").
 * Igual que arriba, el orden de bodyParams tiene que coincidir con las
 * variables {{1}}, {{2}}, etc. de la plantilla aprobada. Varía según
 * el idioma que el cliente tenía elegido en el menú al reclamarlo —
 * mismo criterio que la confirmación de pedido.
 */
export async function sendMenuLeadCode(params: {
  toPhone: string;
  customerName: string;
  businessName: string;
  rewardText: string;
  claimCode: string;
  language: string;
}): Promise<void> {
  await sendTemplateMessage({
    toPhone: params.toPhone,
    contentSid: params.language === "en" ? LEAD_TEMPLATE_EN : LEAD_TEMPLATE_ES,
    bodyParams: [params.customerName, params.businessName, params.rewardText, params.claimCode],
  });
}

/**
 * Manda un mensaje de campaña de marketing (admin de Zertoo) — usa una
 * plantilla que el admin especifica en el momento por su Content SID
 * directo (ya no por nombre + idioma como con Meta — Twilio identifica
 * cada plantilla+idioma con su propio SID único).
 */
export async function sendMarketingMessage(params: {
  toPhone: string;
  contentSid: string;
  bodyParams: string[];
}): Promise<void> {
  await sendTemplateMessage({
    toPhone: params.toPhone,
    contentSid: params.contentSid,
    bodyParams: params.bodyParams,
  });
}

/**
 * Le confirma al CLIENTE que su pedido llegó — complementa el correo,
 * no lo reemplaza. Sí varía según el idioma que el cliente eligió al
 * pedir (Order.language), igual criterio que los recordatorios de citas.
 */
export async function sendOrderConfirmationWhatsApp(params: {
  toPhone: string;
  customerName: string;
  businessName: string;
  total: string;
  language: string;
}): Promise<void> {
  await sendTemplateMessage({
    toPhone: params.toPhone,
    contentSid: params.language === "en" ? ORDER_CONFIRMATION_EN : ORDER_CONFIRMATION_ES,
    bodyParams: [params.customerName, params.businessName, params.total],
  });
}

/**
 * Le avisa al NEGOCIO que le llegó un pedido nuevo — al número de
 * contacto configurado en Ajustes. Varía según Tenant.alertLanguage,
 * la preferencia fija que el negocio eligió en Ajustes — no según el
 * idioma del cliente que hizo el pedido.
 *
 * Incluye qué se pidió y cómo se entrega, no solo el total — para que
 * el negocio pueda arrancar a prepararlo mirando el mensaje solo, sin
 * necesidad de abrir el panel primero.
 */
export async function sendNewOrderAlertWhatsApp(params: {
  toPhone: string;
  customerName: string;
  customerPhone: string;
  itemsSummary: string;
  fulfillmentInfo: string;
  total: string;
  language: string;
}): Promise<void> {
  await sendTemplateMessage({
    toPhone: params.toPhone,
    contentSid: params.language === "en" ? NEW_ORDER_ALERT_EN : NEW_ORDER_ALERT_ES,
    bodyParams: [params.customerName, params.itemsSummary, params.fulfillmentInfo, params.total, params.customerPhone],
  });
}
