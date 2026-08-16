import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/admin-auth";
import { sendCampaignEmail } from "@/lib/email";
import { sendMarketingMessage, isWhatsAppConfigured } from "@/lib/whatsapp";

const schema = z.object({
  channel: z.enum(["email", "whatsapp"]),
  tenantId: z.string().nullable(), // null = todos los negocios
  subject: z.string().max(200).optional(), // solo para email
  message: z.string().min(1).max(2000), // cuerpo del correo, o texto de referencia para whatsapp
  whatsappTemplateName: z.string().optional(),
  whatsappTemplateLang: z.string().optional(),
  // Se manda como {{2}} en la plantilla — {{1}} siempre es el nombre del cliente automáticamente.
  whatsappCustomParam: z.string().max(300).optional(),
});

// Límite duro por envío — evita que un formulario mal usado (o un
// error) mande miles de mensajes de una sola vez sin darse cuenta.
// Para bases más grandes, esto habría que rediseñarlo como un job en
// segundo plano en vez de una sola petición HTTP síncrona.
const MAX_RECIPIENTS = 500;

export async function POST(req: NextRequest) {
  const admin = await requireAdmin();
  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const data = parsed.data;

  if (data.channel === "whatsapp" && !isWhatsAppConfigured()) {
    return NextResponse.json({ error: "WhatsApp no está configurado en esta plataforma." }, { status: 503 });
  }
  if (data.channel === "whatsapp" && !data.whatsappTemplateName) {
    return NextResponse.json({ error: "Falta el nombre de la plantilla de WhatsApp." }, { status: 400 });
  }

  const customers = await db.customer.findMany({
    where: {
      unsubscribed: false,
      ...(data.tenantId ? { tenantId: data.tenantId } : {}),
      ...(data.channel === "whatsapp" ? { phone: { not: null } } : {}),
    },
    take: MAX_RECIPIENTS,
  });

  let sent = 0;
  let failed = 0;
  const origin = req.headers.get("origin") || `https://${req.headers.get("host")}`;

  for (const customer of customers) {
    try {
      if (data.channel === "email") {
        await sendCampaignEmail({
          to: customer.email,
          subject: data.subject || "Novedades",
          bodyHtml: data.message,
          unsubscribeUrl: `${origin}/unsubscribe?customerId=${customer.id}`,
        });
      } else if (customer.phone) {
        await sendMarketingMessage({
          toPhone: customer.phone,
          templateName: data.whatsappTemplateName!,
          language: data.whatsappTemplateLang || "es",
          bodyParams: [customer.name || "cliente", data.whatsappCustomParam || ""],
        });
      }
      sent++;
    } catch (err) {
      console.error(`No se pudo mandar campaña a ${customer.email}:`, err);
      failed++;
    }
  }

  await db.campaignLog.create({
    data: {
      adminEmail: admin.email,
      channel: data.channel,
      tenantFilter: data.tenantId,
      subject: data.subject,
      message: data.message,
      recipientCount: customers.length,
      sentCount: sent,
      failedCount: failed,
    },
  });

  return NextResponse.json({ recipientCount: customers.length, sent, failed });
}
