import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/admin-auth";
import { logAdminActivity } from "@/lib/admin-log";

const schema = z.object({ suspended: z.boolean() });

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const admin = await requireAdmin();
  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Datos inválidos" }, { status: 400 });
  }

  const tenant = await db.tenant.update({
    where: { id: params.id },
    data: { suspended: parsed.data.suspended },
  });

  await logAdminActivity({
    adminEmail: admin.email,
    action: parsed.data.suspended ? "SUSPEND" : "UNSUSPEND",
    tenantId: tenant.id,
    tenantName: tenant.name,
  });

  return NextResponse.json({ tenant });
}

// Borra el negocio y todo lo asociado (usuarios, platos, citas, links,
// reseñas...) — todas las relaciones en el schema usan onDelete: Cascade
// desde Tenant, así que un solo delete limpia todo.
export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const admin = await requireAdmin();

  const tenant = await db.tenant.findUnique({ where: { id: params.id } });
  if (!tenant) return NextResponse.json({ error: "No encontrado" }, { status: 404 });

  await db.tenant.delete({ where: { id: params.id } });

  // Guardamos tenantName pero no tenantId — el tenant ya no existe.
  await logAdminActivity({
    adminEmail: admin.email,
    action: "DELETE_TENANT",
    tenantName: tenant.name,
    details: `slug: ${tenant.slug}`,
  });

  return NextResponse.json({ ok: true });
}
