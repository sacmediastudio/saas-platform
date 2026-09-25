import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/auth";

const PLATFORMS = ["GOOGLE", "TRIPADVISOR", "YELP", "FACEBOOK", "CUSTOM"] as const;

const createSchema = z.object({
  platform: z.enum(PLATFORMS),
  label: z.string().min(1),
  url: z.string().url(),
});

export async function GET() {
  const session = await requirePermission("REVIEWS");
  const links = await db.externalReviewLink.findMany({
    where: { tenantId: session.tenantId },
    orderBy: { sortOrder: "asc" },
  });
  return NextResponse.json({ links });
}

export async function POST(req: NextRequest) {
  const session = await requirePermission("REVIEWS");
  const parsed = createSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Datos inválidos" }, { status: 400 });
  }

  const count = await db.externalReviewLink.count({ where: { tenantId: session.tenantId } });
  const link = await db.externalReviewLink.create({
    data: { tenantId: session.tenantId, ...parsed.data, sortOrder: count },
  });

  return NextResponse.json({ link }, { status: 201 });
}
