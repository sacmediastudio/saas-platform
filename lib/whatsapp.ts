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
const TEMPLATE_NAME = process.env.WHATSAPP_TEMPLATE_NAME || "booking_reminder";
// El nombre de la plantilla del código de canje (Menú → "Postre gratis"
// o el premio que sea) — es una plantilla SEPARADA de la de
// recordatorios, con su propio texto, así que Meta la aprueba aparte.
const LEAD_TEMPLATE_NAME = process.env.WHATSAPP_LEAD_TEMPLATE_NAME || "menu_lead_reward";
// WhatsApp permite tener la MISMA plantilla (mismo nombre) aprobada en
// varios idiomas a la vez — Meta las trata como variantes de idioma de
// una sola plantilla. Por eso acá hay dos códigos, no uno: el código
// exacto tiene que coincidir con el que aprobaste en Meta Business
// Manager para cada versión.
const TEMPLATE_LANG_ES = process.env.WHATSAPP_TEMPLATE_LANG_ES || "es";
const TEMPLATE_LANG_EN = process.env.WHATSAPP_TEMPLATE_LANG_EN || "en_US";

function resolveTemplateLang(language: string): string {
  return language === "en" ? TEMPLATE_LANG_EN : TEMPLATE_LANG_ES;
}

export function isWhatsAppConfigured(): boolean {
  return Boolean(ACCESS_TOKEN && PHONE_NUMBER_ID);
}

/** Deja el número en el formato que espera la API (solo dígitos, con código de país, sin +, espacios ni guiones). */
function normalizePhone(phone: string): string {
  return phone.replace(/[^\d]/g, "");
}

/**
 * Función base: manda cualquier plantilla aprobada con sus parámetros
 * en orden — ambas funciones de arriba de este archivo la usan por
 * dentro, para no repetir la llamada a la API dos veces.
 */
async function sendTemplateMessage(params: {
  toPhone: string;
  templateName: string;
  language: string;
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
        language: { code: resolveTemplateLang(params.language) },
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
    language: params.language,
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
  language?: string;
}): Promise<void> {
  await sendTemplateMessage({
    toPhone: params.toPhone,
    templateName: LEAD_TEMPLATE_NAME,
    language: params.language ?? "es",
    bodyParams: [params.customerName, params.businessName, params.rewardText, params.claimCode],
  });
}

/**
 * Manda un mensaje de campaña de marketing (admin de Zertoo) — usa una
 * plantilla de categoría "Marketing" que el admin especifica en el
 * momento (distinta de las de recordatorio y código de canje, que son
 * fijas). WhatsApp exige que este tipo de mensaje use plantillas de
 * categoría Marketing específicamente, aprobadas con el consentimiento
 * correspondiente — ver .env.example.
 */
export async function sendMarketingMessage(params: {
  toPhone: string;
  templateName: string;
  language: string;
  bodyParams: string[];
}): Promise<void> {
  await sendTemplateMessage({
    toPhone: params.toPhone,
    templateName: params.templateName,
    language: params.language,
    bodyParams: params.bodyParams,
  });
}
