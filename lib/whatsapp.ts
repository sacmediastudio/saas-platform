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
// Idioma con el que se aprobó la plantilla en Meta Business Manager —
// tiene que coincidir exactamente (es común usar "es" o "es_MX").
const TEMPLATE_LANG = process.env.WHATSAPP_TEMPLATE_LANG || "es";

export function isWhatsAppConfigured(): boolean {
  return Boolean(ACCESS_TOKEN && PHONE_NUMBER_ID);
}

/** Deja el número en el formato que espera la API (solo dígitos, con código de país, sin +, espacios ni guiones). */
function normalizePhone(phone: string): string {
  return phone.replace(/[^\d]/g, "");
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
        name: TEMPLATE_NAME,
        language: { code: TEMPLATE_LANG },
        components: [
          {
            type: "body",
            parameters: [
              { type: "text", text: params.customerName },
              { type: "text", text: params.serviceName },
              { type: "text", text: params.dateLabel },
              { type: "text", text: params.timeLabel },
              { type: "text", text: params.businessName },
            ],
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
