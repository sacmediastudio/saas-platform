import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { upsertCustomer } from "@/lib/customers";
import { notifyPassUpdated } from "@/lib/apple-push";
import { upsertLoyaltyObject, isGoogleWalletConfigured } from "@/lib/google-wallet";

// GET /api/public/loyalty/tap?slug=X&cardId=Y — reconoce a un cliente
// que YA tiene el identificador guardado en su dispositivo (de una
// visita anterior), sin sumar nada todavía. Es el paso que arma la
// pantalla "¿Sos Ana? Confirmar sello" para que el empleado la vea
// antes de que se sume de verdad.
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const slug = searchParams.get("slug");
  const cardId = searchParams.get("cardId");
  if (!slug || !cardId) return NextResponse.json({ error: "Faltan datos" }, { status: 400 });

  const tenant = await db.tenant.findUnique({
    where: { slug },
    select: { id: true, name: true, logoUrl: true, walletLogoUrl: true, buttonColor: true, themeTextColor: true, loyaltyEnabled: true, loyaltyVisitsNeeded: true, loyaltyReward: true },
  });
  if (!tenant || !tenant.loyaltyEnabled) return NextResponse.json({ error: "No disponible" }, { status: 404 });

  const card = await db.loyaltyCard.findUnique({ where: { id: cardId } });
  // El id guardado en el dispositivo puede pertenecer a OTRO negocio —
  // cualquiera con acceso a Zertoo Eats puede tener tarjetas de varios
  // negocios distintos guardadas, cada una en su propia clave.
  if (!card || card.tenantId !== tenant.id) return NextResponse.json({ error: "No encontrada" }, { status: 404 });

  return NextResponse.json({
    cardId: card.id,
    businessName: tenant.name,
    logoUrl: tenant.logoUrl,
    customerName: card.customerName,
    stamps: card.stamps,
    visitsNeeded: tenant.loyaltyVisitsNeeded,
    reward: tenant.loyaltyReward,
  });
}

// POST /api/public/loyalty/tap — suma el sello de verdad, recién
// cuando el empleado confirma en pantalla. 2 casos: con "cardId" (ya
// lo reconocíamos) o con "name"+"email" (primera vez, nunca tocó
// antes desde este dispositivo).
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  if (!body?.slug) return NextResponse.json({ error: "Faltan datos" }, { status: 400 });

  const tenant = await db.tenant.findUnique({
    where: { slug: body.slug },
    select: { id: true, name: true, logoUrl: true, walletLogoUrl: true, buttonColor: true, themeTextColor: true, loyaltyEnabled: true, loyaltyVisitsNeeded: true, loyaltyReward: true },
  });
  if (!tenant || !tenant.loyaltyEnabled) return NextResponse.json({ error: "No disponible" }, { status: 404 });

  let card;
  let isNewRegistration = false;
  if (body.cardId) {
    card = await db.loyaltyCard.findUnique({ where: { id: body.cardId } });
    if (!card || card.tenantId !== tenant.id) return NextResponse.json({ error: "No encontrada" }, { status: 404 });
  } else {
    if (!body.name || !body.email) return NextResponse.json({ error: "Faltan datos" }, { status: 400 });
    const email = String(body.email).toLowerCase().trim();
    const existing = await db.loyaltyCard.findUnique({
      where: { tenantId_customerEmail: { tenantId: tenant.id, customerEmail: email } },
    });
    isNewRegistration = !existing;
    card =
      existing ??
      (await db.loyaltyCard.create({
        data: { tenantId: tenant.id, customerEmail: email, customerName: body.name },
      }));
    await upsertCustomer({ tenantId: tenant.id, email, name: body.name, source: "menuLead" });
  }

  // Como esta pantalla vive en una URL pública, sin esto alguien
  // podría intentar tocar "confirmar" varias veces seguidas sin
  // volver a visitar de verdad — un sello por tarjeta cada 20 horas,
  // sin usar límites de día calendario para no complicarse con husos
  // horarios cerca de la medianoche. No aplica en un registro nuevo:
  // no hay ninguna visita previa contra la cual comparar, y esta
  // primera vez tiene que sumar su sello sí o sí.
  if (!isNewRegistration) {
    const hoursSinceLastVisit = (Date.now() - card.lastVisitAt.getTime()) / (1000 * 60 * 60);
    if (hoursSinceLastVisit < 20) {
      return NextResponse.json({ error: "already_stamped_today" }, { status: 429 });
    }
  }

  const updated = await db.loyaltyCard.update({
    where: { id: card.id },
    data: { stamps: { increment: 1 }, lastVisitAt: new Date() },
  });

  // No bloquea la respuesta al cliente — si Apple tarda en responder
  // el push, no tiene sentido que el empleado se quede esperando en
  // pantalla por eso.
  notifyPassUpdated(updated.id).catch((err) => console.error("No se pudo avisar a Apple Wallet:", err));
  if (isGoogleWalletConfigured()) {
    upsertLoyaltyObject({ id: updated.id, customerName: updated.customerName, stamps: updated.stamps }, tenant).catch(
      (err) => console.error("No se pudo actualizar el objeto de Google Wallet:", err)
    );
  }

  return NextResponse.json({
    cardId: updated.id,
    businessName: tenant.name,
    logoUrl: tenant.logoUrl,
    customerName: updated.customerName,
    stamps: updated.stamps,
    visitsNeeded: tenant.loyaltyVisitsNeeded,
    reward: tenant.loyaltyReward,
    justEarned: updated.stamps >= tenant.loyaltyVisitsNeeded,
  });
}
