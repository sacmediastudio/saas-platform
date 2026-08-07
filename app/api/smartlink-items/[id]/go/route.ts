import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

function hrefFor(type: string, value: string | null): string {
  if (type === "WHATSAPP") {
    const digits = (value ?? "").replace(/\D/g, "");
    return `https://wa.me/${digits}`;
  }
  if (type === "PHONE") {
    return `tel:${(value ?? "").replace(/\s+/g, "")}`;
  }
  return value ?? "/";
}

function buildVCard(tenant: {
  name: string;
  contactPhone: string | null;
  contactEmail: string | null;
  address: string | null;
}) {
  const lines = [
    "BEGIN:VCARD",
    "VERSION:3.0",
    `FN:${tenant.name}`,
    `ORG:${tenant.name}`,
  ];
  if (tenant.contactPhone) lines.push(`TEL;TYPE=WORK,VOICE:${tenant.contactPhone}`);
  if (tenant.contactEmail) lines.push(`EMAIL:${tenant.contactEmail}`);
  if (tenant.address) lines.push(`ADR;TYPE=WORK:;;${tenant.address}`);
  lines.push("END:VCARD");
  return lines.join("\n");
}

// GET /api/smartlink-items/[id]/go — cuenta el clic y redirige. Poner
// esto en el href (en vez de la URL directa) es lo que permite contar
// clics sin necesitar JavaScript en la página pública.
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const item = await db.smartLinkItem.findUnique({
    where: { id: params.id },
    include: { tenant: { select: { name: true, contactPhone: true, contactEmail: true, address: true } } },
  });
  if (!item) return NextResponse.redirect(new URL("/", _req.url));

  await db.smartLinkItem.update({
    where: { id: item.id },
    data: { clickCount: { increment: 1 } },
  }).catch(() => {});

  if (item.type === "VCARD") {
    const vcard = buildVCard(item.tenant);
    return new NextResponse(vcard, {
      headers: {
        "Content-Type": "text/vcard; charset=utf-8",
        "Content-Disposition": `attachment; filename="${item.tenant.name.replace(/[^a-z0-9]+/gi, "-")}.vcf"`,
      },
    });
  }

  return NextResponse.redirect(hrefFor(item.type, item.value));
}
