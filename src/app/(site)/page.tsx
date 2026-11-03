import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { Check, MessageCircle, Route, Car } from "lucide-react";

import { HeroSlideshow } from "@/components/home/hero-slideshow";
import { PackageGrid } from "@/components/packages/package-card";
import { FaqList, QuoteCard } from "@/components/site/blocks";
import { CtaBox, RatingDots, SectionHeading } from "@/components/site/section";
import { fallbackImage, siteImages } from "@/content/site-images";
import { strings } from "@/content/strings";
import { listMapDestinations } from "@/server/repositories/destinations";
import { listFeaturedPackages } from "@/server/repositories/packages";
import { listApprovedPhotos } from "@/server/repositories/photos";
import { getSiteReviewAggregate, listPublishedReviews } from "@/server/repositories/reviews";
import { listPublishedTravelInfo } from "@/server/repositories/travel-info";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  description: strings.home.description,
  alternates: { canonical: "/" },
};

const slides = [
  siteImages.hills,
  siteImages.sigiriya,
  siteImages.ella,
  siteImages.galle,
  siteImages.polonnaruwa,
  siteImages.kandy,
  siteImages.tea,
  siteImages.leopard,
  siteImages.elephant,
  siteImages.mirissa,
  siteImages.pidurangala,
];

const whyIcons = [Route, Car, MessageCircle];
const durationChoices = [5, 7, 10, 14];

export default async function HomePage() {
  const [packages, destinations, photos, reviews, aggregate, travelInfo] = await Promise.all([
    listFeaturedPackages(6),
    listMapDestinations(),
    listApprovedPhotos(),
    listPublishedReviews(3),
    getSiteReviewAggregate(),
    listPublishedTravelInfo(),
  ]);

  const rating = aggregate.count > 0 ? aggregate.average.toFixed(1) : null;
  const places = destinations.slice(0, 6);
  const faqs = travelInfo.flatMap((section) => section.faqs).slice(0, 4);

  return (
    <>
      {/* HERO */}
      <section className="relative isolate flex h-[40rem] flex-col items-center overflow-hidden bg-brand">
        <HeroSlideshow slides={slides} />
        <div
          aria-hidden="true"
          className="absolute inset-0 -z-10 bg-[linear-gradient(180deg,rgba(6,40,26,0.62)_0%,rgba(6,40,26,0.45)_50%,rgba(6,40,26,0.35)_78%,rgba(6,40,26,0.7)_100%)]"
        />
        <div className="mt-[4.375rem] flex flex-col items-center gap-4 px-4 text-center">
          <p className="text-xs font-semibold tracking-[0.2em] text-[#BFE5CF] uppercase">
            {strings.home.heroEyebrow}
          </p>
          <h1 className="font-heading text-[2.5rem] leading-[1.08] font-extrabold tracking-[-0.025em] text-white sm:text-[3.625rem]">
            {strings.home.heroLine1}
            <br />
            <span className="text-amber">{strings.home.heroLine2}</span>
          </h1>
          <p className="max-w-[33.75rem] text-base leading-[1.55] text-[#E3F2EA] sm:text-[1.0625rem]">
            {strings.home.heroBody}
          </p>
          <div className="mt-1.5 flex flex-wrap justify-center gap-3.5">
            <Link href="/contact" className="btn-pill">
              {strings.site.planTrip}
            </Link>
            <Link
              href="/packages"
              className="inline-flex h-12 items-center rounded-full border-2 border-white/80 bg-white/10 px-7 text-[0.9375rem] font-semibold text-white backdrop-blur-sm transition-colors hover:bg-white/20"
            >
              {strings.home.browseJourneys}
            </Link>
          </div>
          {rating ? (
            <Link
              href="/reviews"
              className="mt-3.5 flex items-center gap-3.5 rounded-full bg-white px-[1.375rem] py-3 text-sm shadow-[0_6px_24px_rgba(16,33,26,0.12)]"
            >
              <b className="font-heading text-[1.0625rem] text-ink">{rating}</b>
              <RatingDots className="tracking-[2px]" />
              <span className="text-stone">
                {aggregate.count} {strings.reviews.reviewsCount}
              </span>
            </Link>
          ) : null}
        </div>
      </section>

      {/* REVIEWS SUMMARY */}
      {rating ? (
        <section className="px-4 pt-16 sm:px-6">
          <SectionHeading
            eyebrow={strings.home.ratingEyebrow}
            title={strings.home.ratingHeading}
            accent={strings.home.ratingAccent}
          />
          <div className="mx-auto mt-8 flex max-w-[23.75rem] flex-col items-center gap-2.5 rounded-[1.375rem] border border-line bg-white px-7 py-[1.875rem] text-center shadow-panel">
            <p className="font-heading text-5xl leading-none font-extrabold text-ink">
              {rating} <span className="text-[0.9375rem] font-medium text-stone">/ 5</span>
            </p>
            <RatingDots />
            <p className="text-sm text-stone">
              {strings.site.from} <b className="text-ink">{aggregate.count}</b>{" "}
              {strings.home.verifiedReviews}
            </p>
            <Link href="/reviews" className="btn-pill mt-2 h-[2.875rem] px-[1.625rem] text-sm">
              {strings.home.readAllReviews}
            </Link>
          </div>
        </section>
      ) : null}

      {/* QUICK ESTIMATE */}
      <section className="mt-16 bg-band px-4 py-12 sm:px-6">
        <form
          method="get"
          action="/tour-builder"
          className="mx-auto max-w-[62.5rem] rounded-[1.375rem] border border-line bg-white p-6 shadow-panel sm:p-8"
        >
          <div className="flex flex-col gap-1.5 text-center">
            <h2 className="font-heading text-[1.75rem] font-extrabold tracking-[-0.015em] text-ink">
              {strings.home.estimateHeading}
            </h2>
            <p className="text-sm text-stone">{strings.home.estimateBody}</p>
          </div>
          <div className="mt-[1.375rem] grid items-end gap-3.5 sm:grid-cols-[repeat(2,minmax(0,1fr))_200px]">
            <label className="field-label">
              {strings.home.estimateDuration}
              <select name="days" defaultValue="7" className="field">
                {durationChoices.map((days) => (
                  <option key={days} value={days}>
                    {days} {strings.site.days}
                  </option>
                ))}
              </select>
            </label>
            <label className="field-label">
              {strings.home.estimateTravellers}
              <input
                name="adults"
                type="number"
                min={1}
                max={10}
                defaultValue={2}
                className="field"
              />
            </label>
            <button type="submit" className="btn-pill h-[2.875rem]">
              {strings.home.estimateSubmit}
            </button>
          </div>
        </form>
      </section>

      {/* PACKAGES */}
      <section className="px-4 pt-[4.5rem] sm:px-6">
        <SectionHeading
          eyebrow={strings.home.journeysEyebrow}
          title={strings.home.journeysHeading}
          accent={strings.home.journeysAccent}
          intro={packages.length > 0 ? strings.home.journeysIntro : strings.home.featuredEmpty}
        />
        <div className="mx-auto mt-9 max-w-[65rem]">
          <PackageGrid packages={packages} />
        </div>
        <div className="mt-9 text-center">
          <Link href="/packages" className="btn-outline-pill">
            {strings.home.viewAllPackages}
          </Link>
        </div>
      </section>

      {/* DESTINATIONS */}
      {places.length > 0 ? (
        <section className="mt-[4.5rem] bg-band px-4 py-16 sm:px-6">
          <SectionHeading
            eyebrow={strings.home.placesEyebrow}
            title={strings.home.placesHeading}
            accent={strings.home.placesAccent}
          />
          <div className="mx-auto mt-9 grid max-w-[65rem] grid-cols-2 gap-3.5 sm:grid-cols-3 lg:grid-cols-6">
            {places.map((place, index) => {
              const image = place.heroImage
                ? { src: place.heroImage, alt: place.heroImageAlt ?? place.name }
                : fallbackImage(index + 5);
              return (
                <Link
                  key={place.id}
                  href={`/packages?destination=${place.slug}`}
                  className="zoom-img relative block h-[13.75rem] overflow-hidden rounded-2xl shadow-[0_4px_22px_rgba(16,33,26,0.1)]"
                >
                  <Image
                    src={image.src}
                    alt={image.alt}
                    fill
                    sizes="(min-width: 1024px) 170px, (min-width: 640px) 33vw, 50vw"
                    className="object-cover"
                  />
                  <span
                    aria-hidden="true"
                    className="absolute inset-0 bg-[linear-gradient(0deg,rgba(16,33,26,0.75),rgba(16,33,26,0)_55%)]"
                  />
                  <span className="absolute inset-x-3.5 bottom-3.5 font-heading text-[1.0625rem] font-bold text-white">
                    {place.name}
                  </span>
                </Link>
              );
            })}
          </div>
        </section>
      ) : null}

      {/* TRAVELLERS */}
      {photos.length > 0 ? (
        <section className="px-4 pt-[4.5rem] sm:px-6">
          <SectionHeading
            eyebrow={strings.home.photosEyebrow}
            title={strings.home.photosHeading}
            accent={strings.home.photosAccent}
          />
          <div className="mx-auto mt-8 grid max-w-[65rem] grid-cols-2 gap-4 lg:grid-cols-4">
            {photos.slice(0, 8).map((photo) => (
              <Link
                key={photo.id}
                href="/photos"
                className="zoom-img relative block h-56 overflow-hidden rounded-2xl shadow-[0_4px_22px_rgba(16,33,26,0.1)] sm:h-[18.125rem]"
              >
                <Image
                  src={`/photos/${photo.id}`}
                  alt={photo.altText ?? photo.caption ?? strings.photos.heading}
                  fill
                  sizes="(min-width: 1024px) 250px, 50vw"
                  className="object-cover"
                />
                {photo.caption ? (
                  <>
                    <span
                      aria-hidden="true"
                      className="absolute inset-0 bg-[linear-gradient(0deg,rgba(16,33,26,0.8),rgba(16,33,26,0)_50%)]"
                    />
                    <span className="absolute inset-x-3.5 bottom-3.5 text-sm text-white">
                      {photo.caption}
                    </span>
                  </>
                ) : null}
              </Link>
            ))}
          </div>
        </section>
      ) : null}

      {/* WHY US */}
      <section className="mx-4 mt-[4.5rem] rounded-3xl bg-band px-5 py-12 sm:mx-6 sm:px-10 sm:py-14 xl:mx-auto xl:max-w-[70rem]">
        <SectionHeading
          eyebrow={strings.home.whyEyebrow}
          title={strings.home.whyHeading}
          accent={strings.home.whyAccent}
        />
        <div className="mt-8 grid gap-[1.375rem] md:grid-cols-3">
          {strings.home.why.map((item, index) => {
            const Icon = whyIcons[index] ?? Route;
            return (
              <div
                key={item.title}
                className="flex flex-col items-center gap-2.5 rounded-2xl border border-line bg-white px-6 py-7 text-center"
              >
                <span className="flex size-[3.25rem] items-center justify-center rounded-[0.875rem] bg-tint text-brand">
                  <Icon aria-hidden="true" className="size-6" strokeWidth={1.8} />
                </span>
                <h3 className="font-heading text-[1.0625rem] font-bold text-ink">{item.title}</h3>
                <p className="text-sm leading-normal text-stone">{item.description}</p>
              </div>
            );
          })}
        </div>
        <ul className="mx-auto mt-7 grid max-w-[35rem] gap-x-7 gap-y-3 sm:grid-cols-2">
          {strings.home.whyChecklist.map((item) => (
            <li key={item} className="flex items-center gap-2.5 text-sm text-[#34443C]">
              <span className="flex size-[1.375rem] shrink-0 items-center justify-center rounded-full bg-[#D3ECDD] text-brand">
                <Check aria-hidden="true" className="size-3" strokeWidth={3} />
              </span>
              {item}
            </li>
          ))}
        </ul>
      </section>

      {/* TESTIMONIALS */}
      {reviews.length > 0 ? (
        <section className="px-4 pt-[4.5rem] sm:px-6">
          <SectionHeading
            eyebrow={strings.home.reviewsEyebrow}
            title={strings.home.reviewsHeading}
            accent={strings.home.reviewsAccent}
          />
          <div className="mx-auto mt-8 grid max-w-[65rem] gap-[1.375rem] md:grid-cols-3">
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

      {/* FAQ */}
      {faqs.length > 0 ? (
        <section className="px-4 pt-[4.5rem] sm:px-6">
          <SectionHeading
            eyebrow={strings.home.faqEyebrow}
            title={strings.home.faqHeading}
            accent={strings.home.faqAccent}
          />
          <FaqList faqs={faqs} className="mt-8" />
        </section>
      ) : null}

      <CtaBox
        title={strings.home.ctaHeading}
        body={strings.home.ctaBody}
        href="/contact"
        label={strings.home.ctaButton}
      />
    </>
  );
}
