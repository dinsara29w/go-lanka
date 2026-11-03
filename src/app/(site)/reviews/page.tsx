import type { Metadata } from "next";
import Link from "next/link";

import { QuoteCard } from "@/components/site/blocks";
import { CtaBox, PageBanner, RatingDots } from "@/components/site/section";
import { siteImages } from "@/content/site-images";
import { strings } from "@/content/strings";
import { getSiteReviewAggregate, listPublishedReviews } from "@/server/repositories/reviews";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Reviews",
  description: "Verified traveller reviews of Sri Lanka Tours journeys.",
  alternates: { canonical: "/reviews" },
};

export default async function ReviewsPage() {
  const [reviews, aggregate] = await Promise.all([
    listPublishedReviews(100),
    getSiteReviewAggregate(),
  ]);

  return (
    <>
      <PageBanner
        title={strings.reviews.heading}
        intro={strings.reviews.intro}
        image={siteImages.tea}
        crumbs={[{ label: strings.nav.reviews }]}
      />

      <div className="mx-auto grid max-w-[60rem] gap-8 px-4 pt-10 sm:px-6 lg:grid-cols-[18.75rem_minmax(0,1fr)] lg:px-0">
        <aside className="lg:sticky lg:top-24 lg:self-start">
          <div className="flex flex-col items-center gap-2.5 rounded-[1.125rem] border border-line bg-white px-7 py-8 text-center shadow-panel">
            {aggregate.count > 0 ? (
              <>
                <p className="font-heading text-[3.5rem] leading-none font-extrabold text-ink">
                  {aggregate.average.toFixed(1)}{" "}
                  <span className="text-[0.9375rem] font-medium text-stone">/ 5</span>
                </p>
                <RatingDots />
                <p className="text-sm text-stone">
                  {strings.site.from} <b className="text-ink">{aggregate.count}</b>{" "}
                  {strings.home.verifiedReviews}
                </p>
              </>
            ) : (
              <p className="text-sm leading-6 text-stone">{strings.reviews.empty}</p>
            )}
            <Link href="/contact" className="btn-pill mt-2 h-[2.875rem] px-6 text-sm">
              {strings.reviews.writeToUs}
            </Link>
          </div>
        </aside>

        {reviews.length > 0 ? (
          <div className="grid content-start gap-5 sm:grid-cols-2">
            {reviews.map((review) => (
              <QuoteCard
                key={review.id}
                rating={review.rating}
                title={review.title}
                body={review.body}
                name={review.authorName}
                country={review.country}
                journey={{ title: review.packageTitle, slug: review.packageSlug }}
              />
            ))}
          </div>
        ) : null}
      </div>

      <CtaBox
        title={strings.reviews.ctaHeading}
        body={strings.reviews.ctaBody}
        href="/contact"
        label={strings.site.planTrip}
      />
    </>
  );
}
