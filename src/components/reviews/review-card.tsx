import Link from "next/link";
import { BadgeCheck } from "lucide-react";

import { strings } from "@/content/strings";
import type { PublicReview } from "@/server/repositories/reviews";

function Stars({ rating }: { rating: number }) {
  return (
    <span
      className="text-sm tracking-wide text-amber-600"
      aria-label={`${rating} ${strings.reviews.outOfFive}`}
    >
      {"★".repeat(rating)}
      <span className="text-muted-foreground/40">{"★".repeat(5 - rating)}</span>
    </span>
  );
}

export function ReviewCard({
  review,
  showPackage = true,
}: {
  review: PublicReview;
  showPackage?: boolean;
}) {
  return (
    <article className="rounded-xl border border-border bg-card p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Stars rating={review.rating} />
        {review.isVerified ? (
          <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700">
            <BadgeCheck aria-hidden="true" className="size-3.5" />
            {strings.reviews.verified}
          </span>
        ) : null}
      </div>

      {review.title ? (
        <h2 className="mt-3 font-heading text-lg font-semibold">{review.title}</h2>
      ) : null}
      <p className="mt-2 text-sm leading-6 text-muted-foreground">{review.body}</p>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-border/70 pt-3 text-xs text-muted-foreground">
        <span>
          {review.authorName}
          {review.country ? ` · ${review.country}` : ""}
        </span>
        {showPackage ? (
          <Link
            href={`/packages/${review.packageSlug}`}
            className="underline underline-offset-2 hover:text-foreground"
          >
            {review.packageTitle}
          </Link>
        ) : null}
      </div>
    </article>
  );
}

export function ReviewAggregateSummary({ count, average }: { count: number; average: number }) {
  if (count === 0) return null;
  return (
    <div className="flex items-center gap-3 rounded-xl border border-border bg-muted/30 px-4 py-3">
      <Stars rating={Math.round(average)} />
      <p className="text-sm text-muted-foreground">
        <span className="font-medium text-foreground">{average.toFixed(1)}</span>{" "}
        {strings.reviews.outOfFive} · {count} {strings.reviews.reviewsCount}
      </p>
    </div>
  );
}
