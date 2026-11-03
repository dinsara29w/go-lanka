import type { Metadata } from "next";

import { ReviewAggregateSummary, ReviewCard } from "@/components/reviews/review-card";
import { strings } from "@/content/strings";
import { listPublishedReviews } from "@/server/repositories/reviews";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Reviews",
  description: "Verified traveller reviews of Sri Lanka Tours journeys.",
  alternates: { canonical: "/reviews" },
};

export default async function ReviewsPage() {
  const reviews = await listPublishedReviews(100);
  const average =
    reviews.length > 0
      ? reviews.reduce((sum, review) => sum + review.rating, 0) / reviews.length
      : 0;

  return (
    <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-20">
      <div className="max-w-2xl space-y-4">
        <p className="text-sm font-medium text-muted-foreground">{strings.nav.reviews}</p>
        <h1 className="font-heading text-4xl font-semibold tracking-tight sm:text-5xl">
          {strings.reviews.heading}
        </h1>
        <p className="text-base leading-7 text-muted-foreground">{strings.reviews.intro}</p>
      </div>

      {reviews.length === 0 ? (
        <p className="mt-10 rounded-2xl border border-dashed border-border bg-muted/30 p-8 text-sm text-muted-foreground">
          {strings.reviews.empty}
        </p>
      ) : (
        <>
          <div className="mt-8">
            <ReviewAggregateSummary count={reviews.length} average={average} />
          </div>
          <div className="mt-8 grid gap-5 md:grid-cols-2">
            {reviews.map((review) => (
              <ReviewCard key={review.id} review={review} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
