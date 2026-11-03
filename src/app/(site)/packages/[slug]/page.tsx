import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import { Check, MessageCircle } from "lucide-react";

import { DeferredBookingSection } from "@/components/booking/deferred-booking-section";
import { Price } from "@/components/currency/currency-provider";
import { PackageGrid } from "@/components/packages/package-card";
import { FaqList, QuoteCard } from "@/components/site/blocks";
import { CtaBox, PageBanner, SectionHeading, Stars } from "@/components/site/section";
import { JsonLd } from "@/components/seo/json-ld";
import { siteImages } from "@/content/site-images";
import { strings } from "@/content/strings";
import { formatDuration, formatLkr } from "@/lib/currency";
import { getSiteUrl } from "@/lib/site";
import { buildWhatsAppUrl } from "@/lib/whatsapp";
import { getPublicAvailability } from "@/server/repositories/availability";
import { getPublishedPackageBySlug, listFeaturedPackages } from "@/server/repositories/packages";
import { listApprovedPhotos } from "@/server/repositories/photos";
import {
  getPackageReviewAggregate,
  listPublishedReviewsForPackage,
} from "@/server/repositories/reviews";
import { getSiteSettings } from "@/server/repositories/site-settings";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const item = await getPublishedPackageBySlug(slug);
  if (!item) notFound();

  return {
    title: item.title,
    description: item.summary,
    alternates: { canonical: `/packages/${item.slug}` },
    openGraph: {
      title: item.title,
      description: item.summary,
      url: `/packages/${item.slug}`,
      images: item.heroImage
        ? [{ url: item.heroImage, alt: item.heroImageAlt ?? item.title }]
        : undefined,
    },
  };
}

export default async function PackageDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const [item, settings] = await Promise.all([getPublishedPackageBySlug(slug), getSiteSettings()]);

  if (!item) notFound();

  const [availability, reviews, reviewAggregate, travellerPhotos] = await Promise.all([
    getPublicAvailability(item.id),
    listPublishedReviewsForPackage(item.id),
    getPackageReviewAggregate(item.id),
    listApprovedPhotos(item.id),
  ]);
  const turnstileSiteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY?.trim() || null;

  const whatsappHref = settings?.whatsappNumber
    ? buildWhatsAppUrl(
        settings.whatsappNumber,
        strings.whatsapp.packageMessage.replace("{package}", item.title),
      )
    : null;

  const packageFaqs = [
    {
      question: `How long is ${item.title}?`,
      answer: `The published itinerary is ${formatDuration(item.durationDays)}. The final pace can be discussed with the team.`,
    },
    {
      question: "What is included in this journey?",
      answer:
        item.inclusions.length > 0
          ? item.inclusions.join(", ")
          : "The team will confirm the full inclusion list before booking.",
    },
    {
      question: "How much does this journey cost?",
      answer: `The published base price starts at ${formatLkr(item.basePriceLkr)}. Converted prices are indicative; the team confirms the final quote.`,
    },
    {
      question: "Can I customise this itinerary?",
      answer:
        "Yes. Send an enquiry with your dates and interests and the team will adjust the published route where possible.",
    },
  ];
  const siteUrl = getSiteUrl();
  const similar = (await listFeaturedPackages(4))
    .filter((other) => other.id !== item.id)
    .slice(0, 3);
  const banner = item.heroImage
    ? { src: item.heroImage, alt: item.heroImageAlt ?? item.title }
    : siteImages.pidurangala;
  const chips = [
    formatDuration(item.durationDays),
    ...(item.destinations.length > 0
      ? [`${item.destinations.length} ${strings.packages.stopsLabel}`]
      : []),
    ...item.activities.slice(0, 3),
  ];

  return (
    <>
      <PageBanner
        title={item.title}
        intro={item.summary}
        image={banner}
        crumbs={[{ href: "/packages", label: strings.nav.packages }, { label: item.title }]}
      />

      <div className="mx-auto grid max-w-[60rem] gap-10 px-4 pt-10 sm:px-6 lg:grid-cols-[minmax(0,1fr)_20rem] lg:px-0">
        <div className="min-w-0">
          <ul className="flex flex-wrap gap-2.5">
            {chips.map((chip) => (
              <li
                key={chip}
                className="rounded-full bg-tint px-3.5 py-1.5 text-[0.8125rem] font-semibold text-brand"
              >
                {chip}
              </li>
            ))}
          </ul>

          <section className="mt-8">
            <h2 className="font-heading text-[1.625rem] font-bold text-ink">
              {strings.packages.overview}
            </h2>
            {item.destinations.length > 0 ? (
              <p className="mt-3 text-[0.9375rem] leading-relaxed text-stone">
                {item.destinations.map((destination) => destination.name).join(" → ")}
              </p>
            ) : null}
            {item.gallery.length > 0 ? (
              <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3">
                {item.gallery.slice(0, 6).map((image) => (
                  <span
                    key={image.path}
                    className="zoom-img relative block h-28 overflow-hidden rounded-xl sm:h-36"
                  >
                    <Image
                      src={image.path}
                      alt={image.alt}
                      fill
                      sizes="(min-width: 1024px) 200px, 33vw"
                      className="object-cover"
                    />
                  </span>
                ))}
              </div>
            ) : null}
          </section>

          <section className="mt-10">
            <h2 className="font-heading text-[1.625rem] font-bold text-ink">
              {strings.packages.itineraryHeading}
            </h2>
            {item.itinerary.length === 0 ? (
              <p className="mt-3 text-sm leading-6 text-stone">{strings.packages.noItinerary}</p>
            ) : (
              <ol className="mt-4 border-t border-line">
                {item.itinerary.map((day) => (
                  <li key={day.dayNumber} className="flex gap-5 border-b border-line py-5">
                    <span className="flex size-12 shrink-0 flex-col items-center justify-center rounded-xl bg-tint text-brand">
                      <span className="text-[0.625rem] font-semibold uppercase">
                        {strings.packages.dayLabel}
                      </span>
                      <span className="font-heading text-lg leading-none font-extrabold">
                        {day.dayNumber}
                      </span>
                    </span>
                    <div className="min-w-0">
                      <h3 className="font-heading text-[1.0625rem] font-bold text-ink">
                        {day.title}
                      </h3>
                      <p className="mt-1 text-sm leading-relaxed text-stone">{day.description}</p>
                      {day.destinationName || day.accommodation || day.meals.length > 0 ? (
                        <p className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-xs text-stone">
                          {day.destinationName ? (
                            <span>
                              {strings.packages.destinationLabel}: {day.destinationName}
                            </span>
                          ) : null}
                          {day.accommodation ? (
                            <span>
                              {strings.packages.accommodationLabel}: {day.accommodation}
                            </span>
                          ) : null}
                          {day.meals.length > 0 ? (
                            <span>
                              {strings.packages.mealLabel}: {day.meals.join(", ")}
                            </span>
                          ) : null}
                        </p>
                      ) : null}
                    </div>
                  </li>
                ))}
              </ol>
            )}
          </section>

          {item.inclusions.length > 0 || item.exclusions.length > 0 ? (
            <div className="mt-8 grid gap-4 sm:grid-cols-2">
              <IncludedList title={strings.packages.inclusionsHeading} items={item.inclusions} />
              <IncludedList title={strings.packages.exclusionsHeading} items={item.exclusions} />
            </div>
          ) : null}

          <div className="mt-10">
            <DeferredBookingSection
              packageId={item.id}
              availability={availability}
              siteKey={turnstileSiteKey}
            />
          </div>

          {travellerPhotos.length > 0 ? (
            <section className="mt-10">
              <div className="flex flex-wrap items-end justify-between gap-2">
                <h2 className="font-heading text-[1.625rem] font-bold text-ink">
                  {strings.photos.heading}
                </h2>
                <Link href="/photos" className="text-sm font-semibold text-brand hover:underline">
                  {strings.photos.submitHeading}
                </Link>
              </div>
              <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
                {travellerPhotos.slice(0, 8).map((photo) => (
                  <span key={photo.id} className="relative block h-36 overflow-hidden rounded-xl">
                    <Image
                      src={`/photos/${photo.id}`}
                      alt={photo.altText ?? photo.caption ?? strings.photos.heading}
                      fill
                      sizes="(min-width: 640px) 25vw, 50vw"
                      className="object-cover"
                    />
                  </span>
                ))}
              </div>
            </section>
          ) : null}

          {reviews.length > 0 ? (
            <section className="mt-10">
              <h2 className="font-heading text-[1.625rem] font-bold text-ink">
                {strings.reviews.heading}
              </h2>
              <p className="mt-2 flex items-center gap-3 text-sm text-stone">
                <Stars rating={reviewAggregate.average} />
                <span>
                  <b className="text-ink">{reviewAggregate.average.toFixed(1)}</b>{" "}
                  {strings.reviews.outOfFive} · {reviewAggregate.count}{" "}
                  {strings.reviews.reviewsCount}
                </span>
              </p>
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                {reviews.map((review) => (
                  <QuoteCard
                    key={review.id}
                    rating={review.rating}
                    body={review.body}
                    name={review.authorName}
                    country={review.country}
                  />
                ))}
              </div>
            </section>
          ) : null}

          <section className="mt-10">
            <h2 className="font-heading text-[1.625rem] font-bold text-ink">
              {strings.travelInfo.faqHeading}
            </h2>
            <FaqList faqs={packageFaqs} className="mt-4 max-w-none" />
          </section>
        </div>

        <aside className="-order-1 lg:sticky lg:top-24 lg:order-none lg:self-start">
          <div className="rounded-2xl border border-line bg-white p-6 shadow-panel">
            <p className="text-xs text-stone">{strings.site.from}</p>
            <p className="mt-1 font-heading text-[2rem] leading-tight font-extrabold text-brand">
              <Price amountLkr={item.basePriceLkr} />
            </p>
            <p className="mt-2 text-xs leading-5 text-stone">{strings.currency.indicativeNote}</p>
            <a href="#booking" className="btn-pill mt-5 w-full">
              {strings.packages.requestQuote}
            </a>
            {whatsappHref ? (
              <a
                href={whatsappHref}
                target="_blank"
                rel="noopener noreferrer"
                className="btn-outline-pill mt-3 w-full gap-2"
              >
                <MessageCircle aria-hidden="true" className="size-4" />
                {strings.packages.whatsappCta}
              </a>
            ) : null}
            <p className="mt-3 text-center text-xs text-stone">{strings.packages.noPaymentNote}</p>
          </div>
        </aside>
      </div>

      {similar.length > 0 ? (
        <section className="px-4 pt-[4.5rem] sm:px-6">
          <SectionHeading
            eyebrow={strings.packages.similarEyebrow}
            title={strings.packages.similarHeading}
            accent={strings.packages.similarAccent}
          />
          <div className="mx-auto mt-8 max-w-[60rem]">
            <PackageGrid packages={similar} />
          </div>
        </section>
      ) : null}

      <CtaBox
        title={strings.packages.detailCtaHeading}
        body={strings.packages.detailCtaBody}
        href="#booking"
        label={strings.packages.requestQuote}
      />

      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "TouristTrip",
          name: item.title,
          description: item.summary,
          url: `${siteUrl}/packages/${item.slug}`,
          touristType: "International travellers",
          ...(item.heroImage ? { image: `${siteUrl}${item.heroImage}` } : {}),
          provider: {
            "@type": "TravelAgency",
            name: strings.common.siteName,
            url: siteUrl,
          },
          ...(reviewAggregate.count > 0
            ? {
                aggregateRating: {
                  "@type": "AggregateRating",
                  ratingValue: reviewAggregate.average.toFixed(1),
                  reviewCount: reviewAggregate.count,
                  bestRating: 5,
                  worstRating: 1,
                },
                review: reviews.map((review) => ({
                  "@type": "Review",
                  author: { "@type": "Person", name: review.authorName },
                  reviewRating: {
                    "@type": "Rating",
                    ratingValue: review.rating,
                    bestRating: 5,
                    worstRating: 1,
                  },
                  name: review.title ?? undefined,
                  reviewBody: review.body,
                })),
              }
            : {}),
        }}
      />
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "BreadcrumbList",
          itemListElement: [
            {
              "@type": "ListItem",
              position: 1,
              name: strings.nav.home,
              item: siteUrl,
            },
            {
              "@type": "ListItem",
              position: 2,
              name: strings.nav.packages,
              item: `${siteUrl}/packages`,
            },
            {
              "@type": "ListItem",
              position: 3,
              name: item.title,
              item: `${siteUrl}/packages/${item.slug}`,
            },
          ],
        }}
      />
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "FAQPage",
          mainEntity: packageFaqs.map((faq) => ({
            "@type": "Question",
            name: faq.question,
            acceptedAnswer: { "@type": "Answer", text: faq.answer },
          })),
        }}
      />
    </>
  );
}

function IncludedList({ title, items }: { title: string; items: string[] }) {
  return (
    <section className="rounded-2xl border border-line bg-white p-6 shadow-card">
      <h2 className="font-heading text-[1.0625rem] font-bold text-ink">{title}</h2>
      {items.length > 0 ? (
        <ul className="mt-4 space-y-2.5">
          {items.map((entry) => (
            <li key={entry} className="flex items-start gap-2.5 text-sm text-[#34443C]">
              <span className="mt-0.5 flex size-[1.125rem] shrink-0 items-center justify-center rounded-full bg-[#D3ECDD] text-brand">
                <Check aria-hidden="true" className="size-2.5" strokeWidth={3.5} />
              </span>
              {entry}
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-3 text-sm text-stone">{strings.packages.listPending}</p>
      )}
    </section>
  );
}
