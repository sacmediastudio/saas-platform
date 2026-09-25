import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/auth";

const TYPES = [
  "WEBSITE",
  "WHATSAPP",
  "PHONE",
  "INSTAGRAM",
  "FACEBOOK",
  "TIKTOK",
  "TWITTER",
  "YOUTUBE",
  "LINKEDIN",
  "MAPS",
  "VCARD",
  "CUSTOM",
] as const;

const createSchema = z
  .object({
    type: z.enum(TYPES),
    label: z.string().min(1),
    value: z.string().optional(),
  })
  .refine((data) => data.type === "VCARD" || (data.value && data.value.length > 0), {
    message: "Este tipo de link necesita un valor",
    path: ["value"],
  });

export async function GET() {
  const session = await requirePermission("SMARTLINK");
  const items = await db.smartLinkItem.findMany({
    where: { tenantId: session.tenantId },
    orderBy: { sortOrder: "asc" },
  });
  return NextResponse.json({ items });
}

export async function POST(req: NextRequest) {
  const session = await requirePermission("SMARTLINK");
  const parsed = createSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const count = await db.smartLinkItem.count({ where: { tenantId: session.tenantId } });

  const item = await db.smartLinkItem.create({
    data: { tenantId: session.tenantId, sortOrder: count, ...parsed.data },
  });

  return NextResponse.json({ item }, { status: 201 });
}
