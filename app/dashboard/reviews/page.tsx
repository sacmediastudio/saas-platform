import { requireTenant } from "@/lib/auth";
import { db } from "@/lib/db";
import ReviewsView from "./reviews-view";

export default async function ReviewsPage() {
  const session = await requireTenant();

  const reviews = await db.review.findMany({
    where: { tenantId: session.tenantId },
    orderBy: { createdAt: "desc" },
  });

  const serialized = reviews.map((r) => ({
    id: r.id,
    reviewerName: r.reviewerName,
    rating: r.rating,
    comment: r.comment,
    status: r.status,
    createdAt: r.createdAt.toISOString(),
  }));

  const avgRating =
    reviews.length > 0 ? reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length : 0;

  return <ReviewsView initialReviews={serialized} avgRating={avgRating} />;
}
