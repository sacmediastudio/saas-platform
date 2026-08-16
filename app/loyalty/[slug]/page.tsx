import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import LoyaltyLookup from "./loyalty-lookup";

export default async function LoyaltyPublicPage({ params }: { params: { slug: string } }) {
  const tenant = await db.tenant.findUnique({ where: { slug: params.slug }, select: { id: true } });
  if (!tenant) notFound();

  return <LoyaltyLookup slug={params.slug} />;
}
