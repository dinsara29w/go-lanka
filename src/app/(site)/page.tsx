import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { Car, Check, MessageCircle, Route } from "lucide-react";
import { cn } from "cn";

import { CompassStar, CompassWatermark } from "@/components/brand/compass";
import { LogoMark } from "@/components/brand/logo";
import { HeroSlideshow } from "@/components/home/hero-slideshow";
import { PackageGrid } from "@/components/packages/package-card";
import { FaqList, QuoteCard } from "@/components/site/blocks";
import { CtaBox, SectionHeading } from "@/components/site/section";
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
const sectionPad = "px-4 sm:px-6";
const wrap = "mx-auto max-w-[75rem]";

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
  const places = destinations.slice(0, 5);
  const faqs = travelInfo.flatMap((section) => section.faqs).slice(0, 5);

  return (
    <>
      {/* HERO: left-aligned copy over the slideshow */}
      <section className="relative isolate flex min-h-[40rem] items-center overflow-hidden bg-navy pt-16 pb-44 sm:pb-48">
        <HeroSlideshow slides={slides} />
        <div
          aria-hidden="true"
          className="absolute inset-0 -z-10 bg-[linear-gradient(95deg,rgba(10,37,54,0.9)_0%,rgba(10,37,54,0.64)_46%,rgba(10,37,54,0.16)_100%)]"
        />
        <div
          aria-hidden="true"
          className="absolute inset-x-0 bottom-0 -z-10 h-48 bg-gradient-to-t from-navy/70 to-transparent"
        />
        <div className={cn(wrap, "w-full", sectionPad)}>
          <div className="max-w-[40rem]">
            <p className="inline-flex items-center gap-2 rounded-full bg-white/12 px-3.5 py-1.5 text-xs font-bold tracking-[0.16em] text-white uppercase backdrop-blur-sm">
              <CompassStar className="text-gold" />
              {strings.home.heroEyebrow}
            </p>
            <h1 className="mt-5 font-heading text-[2.75rem] leading-[1.02] font-semibold tracking-[-0.025em] text-white sm:text-[4.5rem]">
              {strings.home.heroLine1}
              <br />
              <em className="font-medium text-gold italic">{strings.home.heroLine2}</em>
            </h1>
            <p className="mt-5 max-w-[32rem] text-base leading-relaxed text-white/85 sm:text-lg">
              {strings.home.heroBody}
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Link href="/contact" className="btn-gold">
                {strings.site.planTrip}
              </Link>
              <Link href="/packages" className="btn-outline-light">
                {strings.home.browseJourneys}
              </Link>
            </div>
            {rating ? (
              <Link
                href="/reviews"
                className="mt-7 inline-flex items-center gap-3 text-sm text-white/90 hover:text-white"
              >
                <span aria-hidden="true" className="tracking-[3px] text-gold">
                  ★★★★★
                </span>
                <span>
                  <b className="text-white">{rating}</b> {strings.home.reviewsOutOf} ·{" "}
                  {aggregate.count} {strings.reviews.reviewsCount}
                </span>
              </Link>
            ) : null}
          </div>
        </div>
      </section>

      {/* ESTIMATE: a bar that overlaps the bottom of the hero */}
      <section className={cn("relative z-10 -mt-16", sectionPad)}>
        <form
          method="get"
          action="/tour-builder"
          className="mx-auto grid max-w-[62rem] items-end gap-4 rounded-[1.75rem] border border-line bg-white p-5 shadow-panel sm:p-6 md:grid-cols-[1.5fr_1fr_1fr_auto]"
        >
          <div className="md:pr-4">
            <h2 className="font-heading text-xl font-semibold text-ink">
              {strings.home.estimateHeading}
            </h2>
            <p className="mt-1 text-sm leading-relaxed text-stone">{strings.home.estimateBody}</p>
          </div>
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
          <button type="submit" className="btn-primary">
            {strings.home.estimateSubmit}
          </button>
        </form>
      </section>

      {/* JOURNEYS */}
      <section className={cn("pt-20", sectionPad)}>
        <div className={wrap}>
          <SectionHeading
            align="left"
            eyebrow={strings.home.journeysEyebrow}
            title={strings.home.journeysHeading}
            accent={strings.home.journeysAccent}
            intro={packages.length > 0 ? strings.home.journeysIntro : strings.home.featuredEmpty}
            action={
              <Link href="/packages" className="btn-outline btn-sm shrink-0">
                {strings.home.viewAllPackages}
              </Link>
            }
          />
          <div className="mt-9">
            <PackageGrid packages={packages} />
          </div>
        </div>
      </section>

      {/* WHY GO LANKA: arch photo beside the reasons */}
      <section className={cn("mt-24 bg-band py-20", sectionPad)}>
        <div className={cn(wrap, "grid items-center gap-14 lg:grid-cols-[0.85fr_1.15fr]")}>
          <div className="relative mx-auto w-full max-w-md">
            <div className="relative aspect-[4/5] overflow-hidden rounded-t-[999px] rounded-b-[2rem] shadow-lift">
              <Image
                src={siteImages.kandy.src}
                alt={siteImages.kandy.alt}
                fill
                sizes="(min-width: 1024px) 420px, 90vw"
                className="object-cover"
              />
            </div>
            <div className="absolute -right-2 -bottom-5 flex items-center gap-3 rounded-2xl bg-white py-3 pr-5 pl-3 shadow-panel sm:-right-6">
              <LogoMark size={44} />
              <span className="leading-tight">
                <b className="block font-heading text-base font-semibold text-ink">
                  {strings.home.whyBadgeTitle}
                </b>
                <span className="text-xs text-stone">{strings.home.whyBadgeBody}</span>
              </span>
            </div>
          </div>

          <div>
            <SectionHeading
              align="left"
              eyebrow={strings.home.whyEyebrow}
              title={strings.home.whyHeading}
              accent={strings.home.whyAccent}
            />
            <ol className="mt-8 space-y-6">
              {strings.home.why.map((item, index) => {
                const Icon = whyIcons[index] ?? Route;
                return (
                  <li key={item.title} className="flex gap-4">
                    <span className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-white text-brand shadow-card">
                      <Icon aria-hidden="true" className="size-5" strokeWidth={1.9} />
                    </span>
                    <div>
                      <h3 className="font-heading text-lg font-semibold text-ink">{item.title}</h3>
                      <p className="mt-1 text-sm leading-relaxed text-stone">{item.description}</p>
                    </div>
                  </li>
                );
              })}
            </ol>
            <ul className="mt-8 grid gap-3 border-t border-line pt-7 sm:grid-cols-2">
              {strings.home.whyChecklist.map((item) => (
                <li
                  key={item}
                  className="flex items-center gap-2.5 text-sm font-medium text-ink-soft"
                >
                  <span className="flex size-[1.375rem] shrink-0 items-center justify-center rounded-full bg-leaf-tint text-leaf">
                    <Check aria-hidden="true" className="size-3" strokeWidth={3} />
                  </span>
                  {item}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* PLACES: one big tile and four small ones */}
      {places.length > 0 ? (
        <section className={cn("pt-24", sectionPad)}>
          <div className={wrap}>
            <SectionHeading
              align="left"
              eyebrow={strings.home.placesEyebrow}
              title={strings.home.placesHeading}
              accent={strings.home.placesAccent}
              action={
                <Link href="/map" className="btn-outline btn-sm shrink-0">
                  {strings.home.exploreMap}
                </Link>
              }
            />
            <div className="mt-9 grid auto-rows-[11rem] grid-cols-2 gap-4 md:auto-rows-[12.5rem] md:grid-cols-4">
              {places.map((place, index) => {
                const image = place.heroImage
                  ? { src: place.heroImage, alt: place.heroImageAlt ?? place.name }
                  : fallbackImage(index + 5);
                return (
                  <Link
                    key={place.id}
                    href={`/packages?destination=${place.slug}`}
                    className={cn(
                      "zoom-img relative overflow-hidden rounded-3xl shadow-card",
                      index === 0 && "col-span-2 row-span-2",
                    )}
                  >
                    <Image
                      src={image.src}
                      alt={image.alt}
                      fill
                      sizes={
                        index === 0
                          ? "(min-width: 768px) 600px, 100vw"
                          : "(min-width: 768px) 300px, 50vw"
                      }
                      className="object-cover"
                    />
                    <span
                      aria-hidden="true"
                      className="absolute inset-0 bg-[linear-gradient(0deg,rgba(11,42,61,0.8),rgba(11,42,61,0)_58%)]"
                    />
                    <span className="absolute inset-x-4 bottom-4 text-white">
                      <span
                        className={cn(
                          "block font-heading leading-tight font-semibold",
                          index === 0 ? "text-3xl" : "text-xl",
                        )}
                      >
                        {place.name}
                      </span>
                      <span className="mt-0.5 block text-xs text-white/80">{place.region}</span>
                    </span>
                  </Link>
                );
              })}
            </div>
          </div>
        </section>
      ) : null}

      {/* GUEST PHOTOS: a sideways scrolling strip */}
      {photos.length > 0 ? (
        <section className={cn("pt-24", sectionPad)}>
          <div className={wrap}>
            <SectionHeading
              align="left"
              eyebrow={strings.home.photosEyebrow}
              title={strings.home.photosHeading}
              accent={strings.home.photosAccent}
              action={
                <Link href="/photos" className="btn-outline btn-sm shrink-0">
                  {strings.home.seeGallery}
                </Link>
              }
            />
            <div className="-mx-4 mt-8 flex snap-x snap-mandatory gap-4 overflow-x-auto px-4 pb-4 sm:-mx-6 sm:px-6">
              {photos.slice(0, 10).map((photo) => (
                <Link
                  key={photo.id}
                  href="/photos"
                  className="zoom-img relative h-80 w-64 shrink-0 snap-start overflow-hidden rounded-3xl shadow-card sm:w-72"
                >
                  <Image
                    src={`/photos/${photo.id}`}
                    alt={photo.altText ?? photo.caption ?? strings.photos.heading}
                    fill
                    sizes="288px"
                    className="object-cover"
                  />
                  {photo.caption ? (
                    <>
                      <span
                        aria-hidden="true"
                        className="absolute inset-0 bg-[linear-gradient(0deg,rgba(11,42,61,0.8),rgba(11,42,61,0)_50%)]"
                      />
                      <span className="absolute inset-x-4 bottom-4 text-sm font-medium text-white">
                        {photo.caption}
                      </span>
                    </>
                  ) : null}
                </Link>
              ))}
            </div>
          </div>
        </section>
      ) : null}

      {/* GUEST STORIES: rating panel + quotes */}
      {reviews.length > 0 ? (
        <section className={cn("pt-24", sectionPad)}>
          <div className={wrap}>
            <SectionHeading
              align="left"
              eyebrow={strings.home.reviewsEyebrow}
              title={strings.home.reviewsHeading}
              accent={strings.home.reviewsAccent}
            />
            <div className="mt-9 grid gap-6 lg:grid-cols-[18rem_1fr]">
              {rating ? (
                <div className="relative isolate flex flex-col items-start overflow-hidden rounded-[2rem] bg-navy p-7 text-white lg:self-start">
                  <CompassWatermark className="absolute -right-12 -bottom-12 -z-10 size-56 text-white/10" />
                  <p className="font-heading text-6xl leading-none font-semibold">
                    {rating}
                    <span className="ml-1.5 text-lg font-medium text-white/60">/ 5</span>
                  </p>
                  <span aria-hidden="true" className="mt-3 tracking-[3px] text-gold">
                    ★★★★★
                  </span>
                  <p className="mt-2 text-sm text-white/75">
                    {aggregate.count} {strings.home.verifiedReviews}
                  </p>
                  <Link href="/reviews" className="btn-gold btn-sm mt-6">
                    {strings.home.readAllReviews}
                  </Link>
                </div>
              ) : null}
              <div className="grid gap-5 md:grid-cols-2">
                {reviews.map((review, index) => (
                  <QuoteCard
                    key={review.id}
                    rating={review.rating}
                    body={review.body}
                    name={review.authorName}
                    country={review.country}
                    className={index === 0 && reviews.length > 1 ? "md:col-span-2" : undefined}
                  />
                ))}
              </div>
            </div>
          </div>
        </section>
      ) : null}

      {/* FAQ: heading on the left, answers on the right */}
      {faqs.length > 0 ? (
        <section className={cn("pt-24", sectionPad)}>
          <div className={cn(wrap, "grid gap-10 lg:grid-cols-[0.8fr_1.2fr]")}>
            <div className="lg:sticky lg:top-28 lg:self-start">
              <SectionHeading
                align="left"
                eyebrow={strings.home.faqEyebrow}
                title={strings.home.faqHeading}
                accent={strings.home.faqAccent}
                intro={strings.home.faqIntro}
              />
              <Link href="/contact" className="btn-outline btn-sm mt-6">
                {strings.home.faqContact}
              </Link>
            </div>
            <FaqList faqs={faqs} className="mx-0 max-w-none" />
          </div>
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
