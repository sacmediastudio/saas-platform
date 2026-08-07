import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/admin-auth";
import { logAdminActivity } from "@/lib/admin-log";

const schema = z.object({
  plan: z.enum(["STARTER", "PRO", "BUSINESS"]),
  status: z.enum(["trialing", "active", "past_due", "canceled"]),
});

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const admin = await requireAdmin();
  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Datos inválidos" }, { status: 400 });
  }

  const tenant = await db.tenant.findUnique({ where: { id: params.id } });
  if (!tenant) return NextResponse.json({ error: "No encontrado" }, { status: 404 });

  // upsert: algunos tenants viejos podrían no tener subscription creada.
  const subscription = await db.subscription.upsert({
    where: { tenantId: tenant.id },
    update: { plan: parsed.data.plan, status: parsed.data.status },
    create: { tenantId: tenant.id, plan: parsed.data.plan, status: parsed.data.status },
  });

  // El plan del propio Tenant también se mantiene alineado, ya que
  // varias partes del código leen tenant.plan directamente.
  await db.tenant.update({ where: { id: tenant.id }, data: { plan: parsed.data.plan } });

  await logAdminActivity({
    adminEmail: admin.email,
    action: "UPDATE_SUBSCRIPTION",
    tenantId: tenant.id,
    tenantName: tenant.name,
    details: `plan: ${parsed.data.plan}, estado: ${parsed.data.status}`,
  });

  return NextResponse.json({ subscription });
}
