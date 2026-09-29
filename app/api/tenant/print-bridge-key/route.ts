import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/auth";
import { requireModuleEnabled } from "@/lib/modules";
import { generatePrintBridgeApiKey, hashPrintBridgeApiKey } from "@/lib/print-bridge-auth";

// GET /api/tenant/print-bridge-key — solo dice SI hay una key configurada
// y cuándo se generó, nunca la key en sí (no se puede recuperar después
// de la pantalla de generación, mismo criterio que un password).
export async function GET() {
  const session = await requirePermission("ORDERS");
  await requireModuleEnabled(session.tenantId, "ORDERS");
  const tenant = await db.tenant.findUnique({
    where: { id: session.tenantId },
    select: { printBridgeApiKeyCreatedAt: true },
  });
  return NextResponse.json({ configured: Boolean(tenant?.printBridgeApiKeyCreatedAt), createdAt: tenant?.printBridgeApiKeyCreatedAt ?? null });
}

// POST /api/tenant/print-bridge-key — genera (o regenera) la key. La
// anterior deja de funcionar de inmediato si ya había una.
export async function POST() {
  const session = await requirePermission("ORDERS");
  await requireModuleEnabled(session.tenantId, "ORDERS");

  const rawKey = generatePrintBridgeApiKey();
  await db.tenant.update({
    where: { id: session.tenantId },
    data: { printBridgeApiKeyHash: hashPrintBridgeApiKey(rawKey), printBridgeApiKeyCreatedAt: new Date() },
  });

  return NextResponse.json({ apiKey: rawKey });
}

// DELETE /api/tenant/print-bridge-key — revoca sin generar una nueva.
export async function DELETE() {
  const session = await requirePermission("ORDERS");
  await requireModuleEnabled(session.tenantId, "ORDERS");
  await db.tenant.update({
    where: { id: session.tenantId },
    data: { printBridgeApiKeyHash: null, printBridgeApiKeyCreatedAt: null },
  });
  return NextResponse.json({ ok: true });
}
