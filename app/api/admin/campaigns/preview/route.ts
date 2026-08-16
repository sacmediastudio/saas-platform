import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/admin-auth";

export async function GET(req: NextRequest) {
  await requireAdmin();
  const { searchParams } = new URL(req.url);
  const channel = searchParams.get("channel");
  const tenantId = searchParams.get("tenantId");

  const count = await db.customer.count({
    where: {
      unsubscribed: false,
      ...(tenantId ? { tenantId } : {}),
      ...(channel === "whatsapp" ? { phone: { not: null } } : {}),
    },
  });

  return NextResponse.json({ count });
}
