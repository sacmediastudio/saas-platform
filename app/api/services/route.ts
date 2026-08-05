import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireTenant } from "@/lib/auth";

export async function GET() {
  const session = await requireTenant();

  const [services, staff] = await Promise.all([
    db.service.findMany({ where: { tenantId: session.tenantId } }),
    db.staffMember.findMany({ where: { tenantId: session.tenantId } }),
  ]);

  const serializedServices = services.map((s) => ({ ...s, price: Number(s.price) }));

  return NextResponse.json({ services: serializedServices, staff });
}
