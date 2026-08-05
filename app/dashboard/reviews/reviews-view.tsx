"use client";

import { useState } from "react";
import { Star } from "lucide-react";

interface ReviewRow {
  id: string;
  reviewerName: string;
  rating: number;
  comment: string | null;
  status: "PUBLISHED" | "HIDDEN" | "REPORTED";
  createdAt: string;
}

export default function ReviewsView({
  initialReviews,
  avgRating,
}: {
  initialReviews: ReviewRow[];
  avgRating: number;
}) {
  const [reviews, setReviews] = useState(initialReviews);

  async function toggleVisibility(review: ReviewRow) {
    const next = review.status === "PUBLISHED" ? "HIDDEN" : "PUBLISHED";
    const prev = reviews;
    setReviews((r) => r.map((x) => (x.id === review.id ? { ...x, status: next } : x)));

    const res = await fetch(`/api/reviews/${review.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: next }),
    });
    if (!res.ok) setReviews(prev);
  }

  return (
    <div>
      <h1 className="text-xl font-semibold mb-1">Reseñas</h1>
      <p className="text-sm text-neutral-400 mb-6">
        {reviews.length} reseñas · {avgRating.toFixed(1)} promedio
      </p>

      {reviews.length === 0 && <p className="text-sm text-neutral-500">Todavía no tienes reseñas.</p>}

      <div className="flex flex-col gap-2.5">
        {reviews.map((r) => (
          <div key={r.id} className="border border-neutral-800 rounded-lg p-3.5">
            <div className="flex justify-between items-start">
              <div>
                <p className="font-medium text-sm">{r.reviewerName}</p>
                <div className="flex items-center gap-0.5 my-1">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Star
                      key={i}
                      size={13}
                      className={i < r.rating ? "fill-amber-400 text-amber-400" : "text-neutral-700"}
                      aria-hidden
                    />
                  ))}
                </div>
              </div>
              <button
                onClick={() => toggleVisibility(r)}
                className="text-xs px-2.5 py-1 rounded-md border border-neutral-700 hover:bg-neutral-800 shrink-0"
              >
                {r.status === "PUBLISHED" ? "Ocultar" : "Publicar"}
              </button>
            </div>
            {r.comment && <p className="text-sm text-neutral-300 mt-1">{r.comment}</p>}
          </div>
        ))}
      </div>
    </div>
  );
}
