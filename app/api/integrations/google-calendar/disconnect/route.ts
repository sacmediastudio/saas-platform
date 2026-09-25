import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/auth";

export async function POST() {
  const session = await requirePermission("BOOKINGS");
  await db.googleCalendarConnection.deleteMany({ where: { tenantId: session.tenantId } });
  return NextResponse.json({ ok: true });
}
