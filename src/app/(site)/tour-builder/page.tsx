import type { Metadata } from "next";

import { PageBanner } from "@/components/site/section";
import { TourBuilderExperience } from "@/components/tour-builder/tour-builder-experience";
import { fallbackImage, siteImages } from "@/content/site-images";
import { strings } from "@/content/strings";
import { getTourBuilderContext } from "@/server/ai/context";
import { getBuilderSetupIssues } from "@/server/ai/readiness";
import { listMapDestinations } from "@/server/repositories/destinations";
import { getTourBuilderRates } from "@/server/repositories/tour-builder-rates";

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
  searchParams: Promise<{ days?: string; adults?: string; places?: string }>;
}) {
  const [params, context, mapDestinations, rates] = await Promise.all([
    searchParams,
    getTourBuilderContext(),
    listMapDestinations(),
    getTourBuilderRates(),
  ]);
  const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY?.trim() || null;
  // ?places=ella,kandy picks those places up front (used by the tiles on the home page).
  const knownSlugs = new Set(context.destinations.map((destination) => destination.slug));
  const initialLocations = (params.places ?? "")
    .split(",")
    .map((slug) => slug.trim())
    .filter((slug) => knownSlugs.has(slug))
    .slice(0, 10);
  const setupIssues =
    process.env.NODE_ENV === "production"
      ? []
      : getBuilderSetupIssues({
          destinationCount: context.destinations.length,
          hasSiteKey: Boolean(siteKey),
        });
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
        {setupIssues.length > 0 ? (
          <div
            role="note"
            className="mb-8 rounded-2xl border border-gold bg-gold/15 p-5 text-sm text-ink"
          >
            <p className="font-bold">{strings.tourBuilder.setup.heading}</p>
            <ul className="mt-2 list-disc space-y-1.5 pl-5 leading-relaxed">
              {setupIssues.map((issue) => (
                <li key={issue}>{strings.tourBuilder.setup[issue]}</li>
              ))}
            </ul>
            <p className="mt-3 text-xs text-ink-soft">{strings.tourBuilder.setup.note}</p>
          </div>
        ) : null}
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
          tierRatesLkr={rates.tierRatesLkr}
          vehicles={rates.vehicles.map((vehicle) => ({
            id: vehicle.id,
            name: vehicle.name,
            mode: vehicle.mode,
            maxPax: vehicle.maxPax,
            perKmRateLkr: vehicle.perKmRateLkr,
            dailyRateLkr: vehicle.dailyRateLkr,
            includedKmPerDay: vehicle.includedKmPerDay,
          }))}
          initialLocations={initialLocations}
          initialDays={clampParam(params.days, 1, 21, 7)}
          initialAdults={clampParam(params.adults, 1, 10, 2)}
        />
      </div>
    </>
  );
}
