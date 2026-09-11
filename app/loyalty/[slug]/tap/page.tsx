import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { ensureTrialEndsAt, getBillingStatus } from "@/lib/billing-status";
import UnavailableMessage from "@/components/unavailable-message";
import LoyaltyTap from "./loyalty-tap";

export default async function LoyaltyTapPage({ params }: { params: { slug: string } }) {
  const tenant = await db.tenant.findUnique({ where: { slug: params.slug } });
  if (!tenant || tenant.suspended || !tenant.loyaltyEnabled) notFound();

  const subscription = await db.subscription.findUnique({ where: { tenantId: tenant.id } });
  const trialEndsAt = await ensureTrialEndsAt(db, tenant);
  if (getBillingStatus({ trialEndsAt }, subscription) === "trial_expired") return <UnavailableMessage />;

  return <LoyaltyTap slug={params.slug} />;
}
