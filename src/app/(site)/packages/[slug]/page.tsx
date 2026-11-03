import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import { ArrowLeft, CalendarDays, MapPin, MessageCircle } from "lucide-react";

import { DeferredBookingSection } from "@/components/booking/deferred-booking-section";
import { Price } from "@/components/currency/currency-provider";
import { ReviewAggregateSummary, ReviewCard } from "@/components/reviews/review-card";
import { JsonLd } from "@/components/seo/json-ld";
import { Button } from "@/components/ui/button";
import { strings } from "@/content/strings";
import { formatDuration, formatLkr } from "@/lib/currency";
import { getSiteUrl } from "@/lib/site";
import { buildWhatsAppUrl } from "@/lib/whatsapp";
import { getPublicAvailability } from "@/server/repositories/availability";
import { getPublishedPackageBySlug } from "@/server/repositories/packages";
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

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 sm:py-16">
      <Link
        href="/packages"
        className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft aria-hidden="true" className="size-4" />
        {strings.packages.backToPackages}
      </Link>

      <div className="mt-6 grid gap-8 lg:grid-cols-[1.2fr_0.8fr] lg:items-start">
        <div>
          {item.heroImage ? (
            <Image
              src={item.heroImage}
              alt={item.heroImageAlt ?? item.title}
              width={1200}
              height={800}
              sizes="(min-width: 1024px) 60vw, 100vw"
              priority
              className="h-72 w-full rounded-2xl object-cover sm:h-96"
            />
          ) : (
            <div
              aria-hidden="true"
              className="h-72 w-full rounded-2xl bg-[radial-gradient(circle_at_20%_20%,oklch(0.92_0.05_160),transparent_50%),radial-gradient(circle_at_80%_70%,oklch(0.94_0.05_80),transparent_55%)] sm:h-96"
            />
          )}
        </div>

        <div className="space-y-5">
          <div className="space-y-3">
            <h1 className="font-heading text-4xl font-semibold tracking-tight text-balance">
              {item.title}
            </h1>
            <p className="text-base leading-7 text-muted-foreground">{item.summary}</p>
          </div>

          <div className="flex flex-wrap gap-3 text-sm text-muted-foreground">
            <span className="inline-flex items-center gap-2 rounded-full border border-border px-3 py-1.5">
              <CalendarDays aria-hidden="true" className="size-4" />
              {formatDuration(item.durationDays)}
            </span>
            {item.activities.slice(0, 4).map((activity) => (
              <span
                key={activity}
                className="inline-flex items-center gap-2 rounded-full border border-border px-3 py-1.5"
              >
                <MapPin aria-hidden="true" className="size-4" />
                {activity}
              </span>
            ))}
          </div>

          <div className="rounded-xl border border-border bg-muted/30 p-4">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">
              {strings.packages.indicativePrice}
            </p>
            <p className="mt-1 font-heading text-3xl font-semibold">
              <Price amountLkr={item.basePriceLkr} />
            </p>
            <p className="mt-2 text-xs text-muted-foreground">{strings.currency.indicativeNote}</p>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row">
            <Button asChild size="lg">
              <Link href="/contact">{strings.packages.enquiryCta}</Link>
            </Button>
            {whatsappHref ? (
              <Button asChild size="lg" variant="outline">
                <a href={whatsappHref} target="_blank" rel="noopener noreferrer">
                  <MessageCircle aria-hidden="true" />
                  {strings.packages.whatsappCta}
                </a>
              </Button>
            ) : null}
          </div>
        </div>
      </div>

      <div className="mt-12">
        <DeferredBookingSection
          packageId={item.id}
          availability={availability}
          siteKey={turnstileSiteKey}
        />
      </div>

      {item.gallery.length > 0 ? (
        <section className="mt-12 space-y-4">
          <h2 className="font-heading text-2xl font-semibold tracking-tight">
            {strings.packages.galleryHeading}
          </h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {item.gallery.map((image) => (
              <Image
                key={image.path}
                src={image.path}
                alt={image.alt}
                width={600}
                height={400}
                sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
                className="h-52 w-full rounded-xl border border-border object-cover"
              />
            ))}
          </div>
        </section>
      ) : null}

      {travellerPhotos.length > 0 ? (
        <section className="mt-12 space-y-4">
          <div className="flex flex-wrap items-end justify-between gap-2">
            <h2 className="font-heading text-2xl font-semibold tracking-tight">
              {strings.photos.heading}
            </h2>
            <Link href="/photos" className="text-sm text-muted-foreground hover:text-foreground">
              {strings.photos.submitHeading}
            </Link>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {travellerPhotos.slice(0, 8).map((photo) => (
              <Image
                key={photo.id}
                src={`/photos/${photo.id}`}
                alt={photo.altText ?? photo.caption ?? "Traveller photo"}
                width={400}
                height={300}
                sizes="(min-width: 1024px) 25vw, (min-width: 640px) 50vw, 100vw"
                className="h-40 w-full rounded-xl border border-border object-cover"
              />
            ))}
          </div>
        </section>
      ) : null}

      <div className="mt-12 grid gap-8 lg:grid-cols-[1.3fr_0.7fr] lg:items-start">
        <section className="space-y-4">
          <h2 className="font-heading text-2xl font-semibold tracking-tight">
            {strings.packages.itineraryHeading}
          </h2>

          {item.itinerary.length === 0 ? (
            <p className="text-sm leading-6 text-muted-foreground">
              {strings.packages.noItinerary}
            </p>
          ) : (
            <div className="space-y-3">
              {item.itinerary.map((day) => (
                <details
                  key={day.dayNumber}
                  className="group rounded-xl border border-border bg-card p-4 open:bg-muted/20"
                >
                  <summary className="cursor-pointer list-none font-medium [&::-webkit-details-marker]:hidden">
                    <span className="text-sm text-muted-foreground">
                      {strings.packages.dayLabel} {day.dayNumber}
                    </span>
                    <span className="mt-1 block font-heading text-lg">{day.title}</span>
                  </summary>
                  <div className="mt-3 space-y-3 text-sm leading-6 text-muted-foreground">
                    <p>{day.description}</p>
                    <div className="flex flex-wrap gap-x-6 gap-y-1 text-xs">
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
                    </div>
                  </div>
                </details>
              ))}
            </div>
          )}
        </section>

        <aside className="space-y-6">
          <section className="rounded-xl border border-border bg-card p-5">
            <h2 className="font-heading text-lg font-semibold">
              {strings.packages.inclusionsHeading}
            </h2>
            <ul className="mt-3 space-y-2 text-sm leading-6 text-muted-foreground">
              {item.inclusions.map((inclusion) => (
                <li key={inclusion}>• {inclusion}</li>
              ))}
            </ul>
          </section>

          <section className="rounded-xl border border-border bg-card p-5">
            <h2 className="font-heading text-lg font-semibold">
              {strings.packages.exclusionsHeading}
            </h2>
            <ul className="mt-3 space-y-2 text-sm leading-6 text-muted-foreground">
              {item.exclusions.map((exclusion) => (
                <li key={exclusion}>• {exclusion}</li>
              ))}
            </ul>
          </section>

          {item.destinations.length > 0 ? (
            <section className="rounded-xl border border-border bg-card p-5">
              <h2 className="font-heading text-lg font-semibold">
                {strings.packages.destinationsHeading}
              </h2>
              <div className="mt-3 flex flex-wrap gap-2">
                {item.destinations.map((destination) => (
                  <span
                    key={destination.id}
                    className="rounded-full border border-border px-3 py-1 text-xs text-muted-foreground"
                  >
                    {destination.name}
                  </span>
                ))}
              </div>
            </section>
          ) : null}
        </aside>
      </div>

      <section className="mt-12 rounded-2xl border border-border bg-muted/30 p-6 sm:p-8">
        <h2 className="font-heading text-2xl font-semibold tracking-tight">
          {strings.packages.enquiryHeading}
        </h2>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
          {strings.packages.enquiryBody}
        </p>
        <div className="mt-5 flex flex-wrap gap-3">
          <Button asChild>
            <Link href="/contact">{strings.packages.enquiryCta}</Link>
          </Button>
          {whatsappHref ? (
            <Button asChild variant="outline">
              <a href={whatsappHref} target="_blank" rel="noopener noreferrer">
                {strings.packages.whatsappCta}
              </a>
            </Button>
          ) : null}
        </div>
      </section>

      <section className="mt-12 space-y-4">
        <h2 className="font-heading text-2xl font-semibold tracking-tight">
          {strings.travelInfo.faqHeading}
        </h2>
        {packageFaqs.map((faq) => (
          <details key={faq.question} className="rounded-xl border border-border bg-card p-4">
            <summary className="cursor-pointer list-none font-medium [&::-webkit-details-marker]:hidden">
              {faq.question}
            </summary>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">{faq.answer}</p>
          </details>
        ))}
      </section>

      <section className="mt-12 space-y-5">
        <h2 className="font-heading text-2xl font-semibold tracking-tight">
          {strings.reviews.heading}
        </h2>
        {reviews.length === 0 ? (
          <p className="rounded-xl border border-dashed border-border p-5 text-sm text-muted-foreground">
            {strings.packages.reviewsPlaceholder}
          </p>
        ) : (
          <>
            <ReviewAggregateSummary
              count={reviewAggregate.count}
              average={reviewAggregate.average}
            />
            <div className="grid gap-5 md:grid-cols-2">
              {reviews.map((review) => (
                <ReviewCard key={review.id} review={review} showPackage={false} />
              ))}
            </div>
          </>
        )}
      </section>

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
    </div>
  );
}
