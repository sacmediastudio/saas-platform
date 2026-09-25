import { requirePagePermission } from "@/lib/auth";
import { db } from "@/lib/db";
import FaqsView from "./faqs-view";

export default async function FaqsPage() {
  const session = await requirePagePermission("FAQS");
  const faqs = await db.faqItem.findMany({
    where: { tenantId: session.tenantId },
    orderBy: { sortOrder: "asc" },
  });
  return <FaqsView initialFaqs={faqs} />;
}
