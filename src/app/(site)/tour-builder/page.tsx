import type { Metadata } from "next";

import { TourBuilderExperience } from "@/components/tour-builder/tour-builder-experience";
import { strings } from "@/content/strings";
import { getTourBuilderContext } from "@/server/ai/context";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Tour builder",
  description:
    "Build a personalised Sri Lanka itinerary from our published destinations and journeys.",
  alternates: { canonical: "/tour-builder" },
};

export default async function TourBuilderPage() {
  const context = await getTourBuilderContext();
  const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY?.trim() || null;

  return (
    <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-20">
      <div className="max-w-2xl space-y-4">
        <p className="text-sm font-medium text-muted-foreground">{strings.nav.tourBuilder}</p>
        <h1 className="font-heading text-4xl font-semibold tracking-tight sm:text-5xl">
          {strings.tourBuilder.heading}
        </h1>
        <p className="text-base leading-7 text-muted-foreground">{strings.tourBuilder.intro}</p>
      </div>

      <div className="mt-10">
        <TourBuilderExperience
          destinations={context.destinations.map((destination) => ({
            name: destination.name,
            slug: destination.slug,
            lat: destination.lat,
            lng: destination.lng,
          }))}
          siteKey={siteKey}
        />
      </div>
    </div>
  );
}
