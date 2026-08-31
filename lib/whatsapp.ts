/**
 * Envía mensajes de WhatsApp usando la API oficial de Meta (WhatsApp
 * Cloud API) — llamadas REST directas, sin SDK, mismo criterio que
 * usamos para Google Calendar. Para mensajes que el negocio inicia
 * (como un recordatorio, fuera de una conversación activa), WhatsApp
 * EXIGE que se use una plantilla previamente aprobada por Meta — no se
 * puede mandar texto libre. Ver .env.example para cómo crear esa
 * plantilla y conseguir las credenciales.
 */

const ACCESS_TOKEN = process.env.WHATSAPP_ACCESS_TOKEN;
const PHONE_NUMBER_ID = process.env.WHATSAPP_PHONE_NUMBER_ID;

// Cada plantilla tiene SU PROPIO par de códigos de idioma — no se
// comparten entre plantillas a propósito. Cuando armamos los
// recordatorios de citas, la plantilla en español quedó aprobada por
// Meta como "es_CO" (no el genérico "es") — no hay garantía de que
// otra plantilla nueva quede aprobada con el mismo código exacto, así
// que cada una resuelve su propio idioma de forma independiente.
const TEMPLATE_NAME = process.env.WHATSAPP_TEMPLATE_NAME || "booking_reminder";
const TEMPLATE_LANG_ES = process.env.WHATSAPP_TEMPLATE_LANG_ES || "es";
const TEMPLATE_LANG_EN = process.env.WHATSAPP_TEMPLATE_LANG_EN || "en_US";

const LEAD_TEMPLATE_NAME = process.env.WHATSAPP_LEAD_TEMPLATE_NAME || "menu_lead_reward";
const LEAD_TEMPLATE_LANG = process.env.WHATSAPP_LEAD_TEMPLATE_LANG || "es";

// Confirmación de pedido al CLIENTE — sí varía según el idioma que el
// cliente eligió al pedir (mismo criterio que los recordatorios de citas).
const ORDER_CONFIRMATION_TEMPLATE_NAME = process.env.WHATSAPP_ORDER_CONFIRMATION_TEMPLATE_NAME || "order_confirmation";
const ORDER_CONFIRMATION_LANG_ES = process.env.WHATSAPP_ORDER_CONFIRMATION_LANG_ES || "es";
const ORDER_CONFIRMATION_LANG_EN = process.env.WHATSAPP_ORDER_CONFIRMATION_LANG_EN || "en_US";

// Aviso de pedido nuevo al NEGOCIO — a propósito NO varía según el
// idioma del cliente (el dueño del negocio no necesariamente habla el
// mismo idioma que su cliente) — un solo idioma fijo, configurable.
const NEW_ORDER_ALERT_TEMPLATE_NAME = process.env.WHATSAPP_NEW_ORDER_ALERT_TEMPLATE_NAME || "new_order_alert";
const NEW_ORDER_ALERT_LANG = process.env.WHATSAPP_NEW_ORDER_ALERT_LANG || "es";

export function isWhatsAppConfigured(): boolean {
  return Boolean(ACCESS_TOKEN && PHONE_NUMBER_ID);
}

/** Deja el número en el formato que espera la API (solo dígitos, con código de país, sin +, espacios ni guiones). */
function normalizePhone(phone: string): string {
  return phone.replace(/[^\d]/g, "");
}

/**
 * Función base: manda cualquier plantilla aprobada con sus parámetros
 * en orden — recibe el código de idioma YA RESUELTO (cada función de
 * más abajo decide cuál es el correcto para SU plantilla, no hay una
 * resolución compartida/global que pueda mezclar el idioma de una
 * plantilla con el de otra).
 */
async function sendTemplateMessage(params: {
  toPhone: string;
  templateName: string;
  languageCode: string;
  bodyParams: string[];
}): Promise<void> {
  if (!isWhatsAppConfigured()) return;

  const res = await fetch(`https://graph.facebook.com/v20.0/${PHONE_NUMBER_ID}/messages`, {
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
    const body = await res.text().catch(() => "");
    throw new Error(`WhatsApp API respondió ${res.status}: ${body}`);
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
    templateName: TEMPLATE_NAME,
    languageCode: params.language === "en" ? TEMPLATE_LANG_EN : TEMPLATE_LANG_ES,
    bodyParams: [params.customerName, params.serviceName, params.dateLabel, params.timeLabel, params.businessName],
  });
}

/**
 * Manda el código de canje del premio del menú (ej. "Postre gratis").
 * Igual que arriba, el orden de bodyParams tiene que coincidir con las
 * variables {{1}}, {{2}}, etc. de la plantilla aprobada.
 */
export async function sendMenuLeadCode(params: {
  toPhone: string;
  customerName: string;
  businessName: string;
  rewardText: string;
  claimCode: string;
}): Promise<void> {
  await sendTemplateMessage({
    toPhone: params.toPhone,
    templateName: LEAD_TEMPLATE_NAME,
    languageCode: LEAD_TEMPLATE_LANG,
    bodyParams: [params.customerName, params.businessName, params.rewardText, params.claimCode],
  });
}

/**
 * Manda un mensaje de campaña de marketing (admin de Zertoo) — usa una
 * plantilla de categoría "Marketing" que el admin especifica en el
 * momento (distinta de las de recordatorio y código de canje, que son
 * fijas). El código de idioma acá es el que el admin escribe
 * directamente en el formulario de la campaña — no se resuelve por
 * "es"/"en", se manda tal cual.
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
    templateName: ORDER_CONFIRMATION_TEMPLATE_NAME,
    languageCode: params.language === "en" ? ORDER_CONFIRMATION_LANG_EN : ORDER_CONFIRMATION_LANG_ES,
    bodyParams: [params.customerName, params.businessName, params.total],
  });
}

/**
 * Le avisa al NEGOCIO que le llegó un pedido nuevo — al número de
 * contacto configurado en Ajustes. A propósito en un solo idioma fijo
 * (no depende de qué idioma eligió el cliente) — no tenemos guardado
 * en qué idioma prefiere leer sus avisos cada negocio.
 *
 * Incluye qué se pidió y cómo se entrega, no solo el total — para que
 * el negocio pueda arrancar a prepararlo mirando el mensaje solo, sin
 * necesidad de abrir el panel primero.
 */
export async function sendNewOrderAlertWhatsApp(params: {
  toPhone: string;
  customerName: string;
  itemsSummary: string;
  fulfillmentInfo: string;
  total: string;
}): Promise<void> {
  await sendTemplateMessage({
    toPhone: params.toPhone,
    templateName: NEW_ORDER_ALERT_TEMPLATE_NAME,
    languageCode: NEW_ORDER_ALERT_LANG,
    bodyParams: [params.customerName, params.itemsSummary, params.fulfillmentInfo, params.total],
  });
}
