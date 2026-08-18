import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { sendMenuLeadCode } from "@/lib/whatsapp";
import { upsertCustomer } from "@/lib/customers";
import { rateLimit, getClientIp } from "@/lib/rate-limit";

const schema = z.object({
  slug: z.string(),
  name: z.string().min(1).max(100),
  email: z.string().email(),
  phone: z.string().min(6).max(30),
});

function generateClaimCode(): string {
  // Corto y fácil de leer/escribir en el mostrador — sin caracteres
  // ambiguos (0/O, 1/I) para que no haya confusión al canjearlo.
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}

// POST /api/public/menu-leads — el cliente deja sus datos desde el
// menú público a cambio de un premio (ej. "Postre gratis"), y le
// mandamos un código de canje por WhatsApp.
export async function POST(req: NextRequest) {
  // Cada llamada exitosa manda un WhatsApp real (cuesta dinero) — 5 por
  // hora por IP alcanza de sobra para uso legítimo y frena el abuso.
  const { allowed, retryAfterSeconds } = rateLimit(`menu-leads:${getClientIp(req)}`, 5, 60 * 60_000);
  if (!allowed) {
    return NextResponse.json(
      { error: "Demasiadas solicitudes. Intenta de nuevo más tarde." },
      { status: 429, headers: { "Retry-After": String(retryAfterSeconds) } }
    );
  }

  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Datos inválidos" }, { status: 400 });
  }
  const { slug, name, email, phone } = parsed.data;

  const tenant = await db.tenant.findUnique({ where: { slug } });
  if (!tenant || !tenant.menuLeadEnabled) {
    return NextResponse.json({ error: "No disponible" }, { status: 404 });
  }

  // Evita que la misma persona (mismo correo) reclame el premio varias
  // veces — le devolvemos su código ya existente en vez de crear otro.
  const existing = await db.menuLead.findFirst({
    where: { tenantId: tenant.id, email: email.toLowerCase().trim() },
  });
  if (existing) {
    return NextResponse.json({ claimCode: existing.claimCode, alreadyClaimed: true });
  }

  let claimCode = generateClaimCode();
  // Diferencia prácticamente nula de choque (32^6 combinaciones), pero
  // por las dudas reintenta si justo coincide con uno ya existente.
  while (await db.menuLead.findUnique({ where: { claimCode } })) {
    claimCode = generateClaimCode();
  }

  const lead = await db.menuLead.create({
    data: { tenantId: tenant.id, name, email: email.toLowerCase().trim(), phone, claimCode },
  });

  await upsertCustomer({
    tenantId: tenant.id,
    email,
    name,
    phone,
    source: "menuLead",
  });

  await sendMenuLeadCode({
    toPhone: phone,
    customerName: name,
    businessName: tenant.name,
    rewardText: tenant.menuLeadRewardText,
    claimCode,
  }).catch((err) => console.error("No se pudo enviar el código de canje por WhatsApp:", err));

  return NextResponse.json({ claimCode: lead.claimCode, alreadyClaimed: false }, { status: 201 });
}
