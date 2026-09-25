import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/auth";
import { isGoogleCalendarConfigured } from "@/lib/google-calendar";

export async function GET() {
  const session = await requirePermission("BOOKINGS");
  const conn = await db.googleCalendarConnection.findUnique({
    where: { tenantId: session.tenantId },
    select: { connectedEmail: true },
  });

  return NextResponse.json({
    configured: isGoogleCalendarConfigured(),
    connected: Boolean(conn),
    email: conn?.connectedEmail ?? null,
  });
}
