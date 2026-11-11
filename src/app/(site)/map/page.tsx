import type { Metadata } from "next";

import { MapExplorer } from "@/components/map/map-explorer";
import { CtaBox, PageBanner } from "@/components/site/section";
import { siteImages } from "@/content/site-images";
import { strings } from "@/content/strings";
import { listMapDestinations } from "@/server/repositories/destinations";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Discover Sri Lanka",
  description: "Explore Sri Lanka by district and find destinations and published journeys.",
  alternates: { canonical: "/map" },
};

export default async function MapPage() {
  const destinations = await listMapDestinations();

  return (
    <>
      <PageBanner
        title={strings.map.heading}
        intro={strings.map.intro}
        image={siteImages.downSouth}
        crumbs={[{ label: strings.nav.map }]}
      />
      <MapExplorer destinations={destinations} />
      <CtaBox
        title={strings.map.ctaHeading}
        body={strings.map.ctaBody}
        href="/contact"
        label={strings.site.planTrip}
      />
    </>
  );
}
