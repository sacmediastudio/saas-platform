/**
 * Envía mensajes de WhatsApp usando la API de Meta directamente (Cloud
 * API) — se volvió a este camino después de que la verificación de
 * negocio en Twilio también fuera rechazada. La app de Meta (ZERTOO)
 * ya está publicada y con las 4 plantillas aprobadas:
 * booking_reminder, order_confirmation, new_order_alert,
 * menu_lead_reward — cada una en español (es_CO) e inglés (en_US).
 *
 * Los nombres de plantilla son los mismos en ambos idiomas — lo que
 * cambia es el "language code" que se manda en cada llamada, no el
 * nombre de la plantilla en sí.
 */

const ACCESS_TOKEN = process.env.WHATSAPP_ACCESS_TOKEN;
const PHONE_NUMBER_ID = process.env.WHATSAPP_PHONE_NUMBER_ID;

const TEMPLATE_BOOKING_REMINDER = process.env.WHATSAPP_TEMPLATE_BOOKING_REMINDER || "booking_reminder";
const TEMPLATE_ORDER_CONFIRMATION = process.env.WHATSAPP_TEMPLATE_ORDER_CONFIRMATION || "order_confirmation";
const TEMPLATE_NEW_ORDER_ALERT = process.env.WHATSAPP_TEMPLATE_NEW_ORDER_ALERT || "new_order_alert";
const TEMPLATE_MENU_LEAD_REWARD = process.env.WHATSAPP_TEMPLATE_MENU_LEAD_REWARD || "menu_lead_reward";

const LANG_ES = process.env.WHATSAPP_TEMPLATE_LANG_ES || "es_CO";
const LANG_EN = process.env.WHATSAPP_TEMPLATE_LANG_EN || "en_US";

export function isWhatsAppConfigured(): boolean {
  return Boolean(ACCESS_TOKEN && PHONE_NUMBER_ID);
}

function normalizePhone(phone: string): string {
  return phone.replace(/[^\d]/g, "");
}

/**
 * Función base: manda cualquier plantilla aprobada con sus parámetros
 * en orden — el orden de bodyParams tiene que coincidir EXACTO con
 * las variables {{1}}, {{2}}, etc. de la plantilla ya aprobada en
 * Meta, no con lo que a uno le parezca lógico. Antes de tocar el
 * orden de una función de más abajo, confirmar el texto real de la
 * plantilla en el dashboard de Meta.
 */
async function sendTemplateMessage(params: {
  toPhone: string;
  templateName: string;
  languageCode: string;
  bodyParams: string[];
}): Promise<void> {
  if (!isWhatsAppConfigured()) return;

  const res = await fetch(`https://graph.facebook.com/v21.0/${PHONE_NUMBER_ID}/messages`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${ACCESS_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      to: normalizePhone(params.toPhone),
      type: "template",
      template: {
        name: params.templateName,
        language: { code: params.languageCode },
        components: [
          {
            type: "body",
            parameters: params.bodyParams.map((text) => ({ type: "text", text })),
          },
        ],
      },
    }),
  });

  if (!res.ok) {
    const responseBody = await res.text().catch(() => "");
    throw new Error(`WhatsApp API respondió ${res.status}: ${responseBody}`);
  }
}

/**
 * Recordatorio de cita. Plantilla real (en_US): "Hello {{1}}, this is
 * a reminder of your appointment for {{2}} on {{3}} at {{4}} at
 * {{5}}." — 5 variables: nombre, servicio, fecha, hora, negocio.
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
    templateName: TEMPLATE_BOOKING_REMINDER,
    languageCode: params.language === "en" ? LANG_EN : LANG_ES,
    bodyParams: [params.customerName, params.serviceName, params.dateLabel, params.timeLabel, params.businessName],
  });
}

/**
 * Código de canje del premio del menú. Plantilla real (es_CO): "Hola
 * {{1}}, tu premio en {{2}} es: {{3}}. Tu código para canjearlo es
 * {{4}}." — 4 variables: nombre, negocio, premio, código.
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
    templateName: TEMPLATE_MENU_LEAD_REWARD,
    languageCode: params.language === "en" ? LANG_EN : LANG_ES,
    bodyParams: [params.customerName, params.businessName, params.rewardText, params.claimCode],
  });
}

/**
 * Mensaje de campaña de marketing (admin de Zertoo) — usa una
 * plantilla que el admin especifica por nombre + idioma directo,
 * ya que puede variar según la campaña.
 */
export async function sendMarketingMessage(params: {
  toPhone: string;
  templateName: string;
  languageCode: string;
  bodyParams: string[];
}): Promise<void> {
  await sendTemplateMessage({
    toPhone: params.toPhone,
    templateName: params.templateName,
    languageCode: params.languageCode,
    bodyParams: params.bodyParams,
  });
}

/**
 * Confirmación de pedido al CLIENTE. Plantilla real (es_CO): "Hola
 * {{1}}, tu pedido en {{2}} fue confirmado. Total: {{3}}." — 3
 * variables: nombre, negocio, total.
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
    templateName: TEMPLATE_ORDER_CONFIRMATION,
    languageCode: params.language === "en" ? LANG_EN : LANG_ES,
    bodyParams: [params.customerName, params.businessName, params.total],
  });
}

/**
 * Aviso de pedido nuevo al NEGOCIO. Plantilla real (es_CO): "🔔
 * Recibiste un pedido de {{1}}. Este es el pedido: {{2}}. Tipo de
 * pedido: {{3}}. El total es: {{4}}. Teléfono del cliente: {{5}}" — 5
 * variables: nombre del cliente, resumen del pedido, tipo de entrega,
 * total, teléfono del cliente. Ojo: esta plantilla cambió de 4 a 5
 * variables en algún momento (se le agregó el teléfono) — si vuelve a
 * editarse en el dashboard de Meta, confirmar de nuevo el orden acá.
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
    templateName: TEMPLATE_NEW_ORDER_ALERT,
    languageCode: params.language === "en" ? LANG_EN : LANG_ES,
    bodyParams: [params.customerName, params.itemsSummary, params.fulfillmentInfo, params.total, params.customerPhone],
  });
}
