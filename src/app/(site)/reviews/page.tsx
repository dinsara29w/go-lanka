import type { Metadata } from "next";
import Link from "next/link";

import { QuoteCard } from "@/components/site/blocks";
import { CompassWatermark } from "@/components/brand/compass";
import { CtaBox, PageBanner } from "@/components/site/section";
import { siteImages } from "@/content/site-images";
import { strings } from "@/content/strings";
import { getSiteReviewAggregate, listPublishedReviews } from "@/server/repositories/reviews";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Reviews",
  description: "Verified traveller reviews of Go Lanka journeys.",
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
          <div className="relative isolate flex flex-col items-start overflow-hidden rounded-[2rem] bg-navy p-7 text-white">
            <CompassWatermark className="absolute -right-12 -bottom-12 -z-10 size-56 text-white/10" />
            {aggregate.count > 0 ? (
              <>
                <p className="font-heading text-6xl leading-none font-semibold">
                  {aggregate.average.toFixed(1)}
                  <span className="ml-1.5 text-lg font-medium text-white/60">/ 5</span>
                </p>
                <span aria-hidden="true" className="mt-3 tracking-[3px] text-gold">
                  ★★★★★
                </span>
                <p className="mt-2 text-sm text-white/75">
                  {aggregate.count} {strings.home.verifiedReviews}
                </p>
              </>
            ) : (
              <p className="text-sm leading-6 text-white/80">{strings.reviews.empty}</p>
            )}
            <Link href="/contact" className="btn-gold btn-sm mt-6">
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
