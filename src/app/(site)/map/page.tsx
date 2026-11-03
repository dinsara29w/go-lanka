import type { Metadata } from "next";

import { MapExplorer } from "@/components/map/map-explorer";
import { strings } from "@/content/strings";
import { listMapDestinations } from "@/server/repositories/destinations";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Island map",
  description: "Explore Sri Lanka by district and find destinations and published journeys.",
  alternates: { canonical: "/map" },
};

export default async function MapPage() {
  const destinations = await listMapDestinations();

  return (
    <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-20">
      <div className="max-w-2xl space-y-4">
        <p className="text-sm font-medium text-muted-foreground">{strings.nav.map}</p>
        <h1 className="font-heading text-4xl font-semibold tracking-tight sm:text-5xl">
          {strings.map.heading}
        </h1>
        <p className="text-base leading-7 text-muted-foreground">{strings.map.intro}</p>
      </div>

      <div className="mt-10">
        <MapExplorer destinations={destinations} />
      </div>
    </div>
  );
}
