import type { Metadata } from "next";

import { PageBanner } from "@/components/site/section";
import { TourBuilderExperience } from "@/components/tour-builder/tour-builder-experience";
import { fallbackImage, siteImages } from "@/content/site-images";
import { strings } from "@/content/strings";
import { getTourBuilderContext } from "@/server/ai/context";
import { listMapDestinations } from "@/server/repositories/destinations";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Tour builder",
  description:
    "Build a personalised Sri Lanka itinerary from our published destinations and journeys.",
  alternates: { canonical: "/tour-builder" },
};

function clampParam(value: string | undefined, min: number, max: number, fallback: number) {
  const parsed = Number.parseInt(value ?? "", 10);
  return Number.isFinite(parsed) ? Math.min(Math.max(parsed, min), max) : fallback;
}

export default async function TourBuilderPage({
  searchParams,
}: {
  searchParams: Promise<{ days?: string; adults?: string }>;
}) {
  const [params, context, mapDestinations] = await Promise.all([
    searchParams,
    getTourBuilderContext(),
    listMapDestinations(),
  ]);
  const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY?.trim() || null;
  const images = new Map(
    mapDestinations
      .filter((destination) => destination.heroImage)
      .map((destination) => [
        destination.slug,
        { src: destination.heroImage as string, alt: destination.heroImageAlt ?? destination.name },
      ]),
  );

  return (
    <>
      <PageBanner
        title={strings.tourBuilder.heading}
        intro={strings.tourBuilder.intro}
        image={siteImages.ella}
        crumbs={[{ label: strings.nav.tourBuilder }]}
      />

      <div className="mx-auto max-w-[60rem] px-4 pt-10 pb-20 sm:px-6 lg:px-0">
        <TourBuilderExperience
          destinations={context.destinations.map((destination, index) => ({
            name: destination.name,
            slug: destination.slug,
            lat: destination.lat,
            lng: destination.lng,
            region: destination.region,
            image: images.get(destination.slug) ?? fallbackImage(index),
          }))}
          siteKey={siteKey}
          initialDays={clampParam(params.days, 1, 21, 7)}
          initialAdults={clampParam(params.adults, 1, 10, 2)}
        />
      </div>
    </>
  );
}
