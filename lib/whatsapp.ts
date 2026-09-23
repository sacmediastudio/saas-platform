/**
 * Envía mensajes de WhatsApp usando Twilio — se volvió a este camino
 * después de que la verificación directa con Meta quedara bloqueada
 * definitivamente por el requisito de ser "Tech Provider" (un status
 * irreversible que no tiene sentido para este proyecto). Twilio ya es
 * Tech Provider por su cuenta, así que no hace falta pasar por eso.
 *
 * Diferencias clave con la API directa de Meta:
 * - Autenticación: Account SID + Auth Token (Basic Auth), no un
 *   token Bearer.
 * - El cuerpo del pedido va como form-urlencoded, no JSON.
 * - Cada plantilla+idioma tiene su propio "Content SID" (empieza con
 *   HX...) en vez de un nombre de plantilla + código de idioma
 *   separados.
 * - El número de destino y el de origen llevan el prefijo
 *   "whatsapp:" antes del +código de país.
 */

const ACCOUNT_SID = process.env.TWILIO_ACCOUNT_SID;
const AUTH_TOKEN = process.env.TWILIO_AUTH_TOKEN;
const WHATSAPP_NUMBER = process.env.TWILIO_WHATSAPP_NUMBER; // formato: +2977472770, sin "whatsapp:"

const TEMPLATE_BOOKING_REMINDER_ES = process.env.TWILIO_TEMPLATE_BOOKING_REMINDER_ES || "";
const TEMPLATE_BOOKING_REMINDER_EN = process.env.TWILIO_TEMPLATE_BOOKING_REMINDER_EN || "";

const TEMPLATE_LEAD_REWARD_ES = process.env.TWILIO_TEMPLATE_LEAD_REWARD_ES || "";
const TEMPLATE_LEAD_REWARD_EN = process.env.TWILIO_TEMPLATE_LEAD_REWARD_EN || "";

const TEMPLATE_ORDER_CONFIRMATION_ES = process.env.TWILIO_TEMPLATE_ORDER_CONFIRMATION_ES || "";
const TEMPLATE_ORDER_CONFIRMATION_EN = process.env.TWILIO_TEMPLATE_ORDER_CONFIRMATION_EN || "";

const TEMPLATE_NEW_ORDER_ALERT_ES = process.env.TWILIO_TEMPLATE_NEW_ORDER_ALERT_ES || "";
const TEMPLATE_NEW_ORDER_ALERT_EN = process.env.TWILIO_TEMPLATE_NEW_ORDER_ALERT_EN || "";

const TEMPLATE_ORDER_CONFIRMED_ETA_ES = process.env.TWILIO_TEMPLATE_ORDER_CONFIRMED_ETA_ES || "";
const TEMPLATE_ORDER_CONFIRMED_ETA_EN = process.env.TWILIO_TEMPLATE_ORDER_CONFIRMED_ETA_EN || "";

const TEMPLATE_ORDER_READY_ES = process.env.TWILIO_TEMPLATE_ORDER_READY_ES || "";
const TEMPLATE_ORDER_READY_EN = process.env.TWILIO_TEMPLATE_ORDER_READY_EN || "";

export function isWhatsAppConfigured(): boolean {
  return Boolean(ACCOUNT_SID && AUTH_TOKEN && WHATSAPP_NUMBER);
}

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
 * Recordatorio de cita. bodyParams tiene que coincidir con el orden
 * de variables de la plantilla real aprobada en Twilio.
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
    contentSid: params.language === "en" ? TEMPLATE_BOOKING_REMINDER_EN : TEMPLATE_BOOKING_REMINDER_ES,
    bodyParams: [params.customerName, params.serviceName, params.dateLabel, params.timeLabel, params.businessName],
  });
}

/**
 * Código de canje del premio del menú. Plantilla: "Hola {{1}}, tu
 * premio en {{2}} es: {{3}}. Tu código para canjearlo es {{4}}." — 4
 * variables: nombre, negocio, premio, código.
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
    contentSid: params.language === "en" ? TEMPLATE_LEAD_REWARD_EN : TEMPLATE_LEAD_REWARD_ES,
    bodyParams: [params.customerName, params.businessName, params.rewardText, params.claimCode],
  });
}

/**
 * Mensaje de campaña de marketing (admin de Zertoo) — usa una
 * plantilla que el admin especifica en el momento por su Content SID
 * directo.
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
 * Confirmación de pedido al CLIENTE. Plantilla: "Hola {{1}}, tu
 * pedido en {{2}} fue confirmado. Total: {{3}}." — 3 variables:
 * nombre, negocio, total.
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
    contentSid: params.language === "en" ? TEMPLATE_ORDER_CONFIRMATION_EN : TEMPLATE_ORDER_CONFIRMATION_ES,
    bodyParams: [params.customerName, params.businessName, params.total],
  });
}

/**
 * Aviso de pedido nuevo al NEGOCIO. Plantilla: "🔔 Recibiste un
 * pedido de {{1}}. Este es el pedido: {{2}}. Tipo de pedido: {{3}}.
 * El total es: {{4}}. Teléfono del cliente: {{5}}. ¡empezá a
 * prepararlo cuanto antes!" — 5 variables. La causa real de los
 * rechazos anteriores no era el teléfono como variable (como se
 * sospechó en un principio) sino que a la plantilla le faltaba la
 * frase final — terminaba justo en {{5}}, una variable suelta sin
 * texto real después, algo que WhatsApp rechaza.
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
    contentSid: params.language === "en" ? TEMPLATE_NEW_ORDER_ALERT_EN : TEMPLATE_NEW_ORDER_ALERT_ES,
    bodyParams: [params.customerName, params.itemsSummary, params.fulfillmentInfo, params.total, params.customerPhone],
  });
}

/**
 * El negocio confirma el pedido y le avisa al CLIENTE con un tiempo
 * estimado — es la respuesta puntual que pidió el cliente (ej. "tu
 * pedido fue confirmado, estará listo en 25 minutos"). Como el
 * cliente nunca le escribe primero al número de WhatsApp del negocio,
 * nunca se abre una ventana de sesión de 24h — por eso esto también
 * tiene que ir por plantilla aprobada, no texto libre. Plantilla:
 * "Hola {{1}}, tu pedido en {{2}} fue confirmado ✅. Estará listo en
 * aprox. {{3}} minutos." — 3 variables: nombre, negocio, minutos.
 */
export async function sendOrderConfirmedWithEtaWhatsApp(params: {
  toPhone: string;
  customerName: string;
  businessName: string;
  etaMinutes: number;
  language: string;
}): Promise<void> {
  await sendTemplateMessage({
    toPhone: params.toPhone,
    contentSid: params.language === "en" ? TEMPLATE_ORDER_CONFIRMED_ETA_EN : TEMPLATE_ORDER_CONFIRMED_ETA_ES,
    bodyParams: [params.customerName, params.businessName, String(params.etaMinutes)],
  });
}

/**
 * El pedido ya está listo (para retirar o en camino) — se avisa al
 * CLIENTE. Plantilla: "Hola {{1}}, tu pedido en {{2}} ya está listo
 * 🎉 {{3}}." — 3 variables: nombre, negocio, nota de retiro/entrega.
 */
export async function sendOrderReadyWhatsApp(params: {
  toPhone: string;
  customerName: string;
  businessName: string;
  fulfillmentNote: string;
  language: string;
}): Promise<void> {
  await sendTemplateMessage({
    toPhone: params.toPhone,
    contentSid: params.language === "en" ? TEMPLATE_ORDER_READY_EN : TEMPLATE_ORDER_READY_ES,
    bodyParams: [params.customerName, params.businessName, params.fulfillmentNote],
  });
}
