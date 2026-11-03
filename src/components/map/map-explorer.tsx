"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import Image from "next/image";

import { SRI_LANKA_MAP_VIEWBOX, sriLankaMapRegions } from "@/content/map-regions";
import { strings } from "@/content/strings";
import type { MapDestination } from "@/server/repositories/destinations";

export function MapExplorer({
  destinations,
  compact = false,
}: {
  destinations: MapDestination[];
  compact?: boolean;
}) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const byRegion = useMemo(() => {
    const map = new Map<string, MapDestination[]>();
    for (const destination of destinations) {
      const list = map.get(destination.mapRegionId) ?? [];
      list.push(destination);
      map.set(destination.mapRegionId, list);
    }
    return map;
  }, [destinations]);

  const selectedRegion = selectedId
    ? sriLankaMapRegions.find((region) => region.id === selectedId)
    : null;
  const selectedDestinations = selectedId ? (byRegion.get(selectedId) ?? []) : [];

  function selectRegion(id: string) {
    setSelectedId(id);
  }

  return (
    <div
      className={
        compact ? "grid gap-4 lg:grid-cols-[1.1fr_0.9fr]" : "grid gap-6 lg:grid-cols-[1.2fr_0.8fr]"
      }
    >
      <div className="rounded-[1.5rem] border border-ink/10 bg-card p-3 shadow-soft sm:p-4">
        <svg
          viewBox={SRI_LANKA_MAP_VIEWBOX}
          role="group"
          aria-label="Interactive map of Sri Lanka districts"
          className={`mx-auto h-auto w-full ${compact ? "max-h-[420px]" : "max-h-[720px]"}`}
        >
          {sriLankaMapRegions.map((region) => {
            const regionDestinations = byRegion.get(region.id) ?? [];
            const selected = region.id === selectedId;
            const hasDestinations = regionDestinations.length > 0;

            return (
              <path
                key={region.id}
                d={region.path}
                role="button"
                tabIndex={0}
                aria-label={`${region.name} ${strings.map.regionLabel}, ${regionDestinations.length} ${strings.map.destinationsHeading.toLowerCase()}`}
                aria-pressed={selected}
                fillRule="evenodd"
                vectorEffect="non-scaling-stroke"
                onClick={() => selectRegion(region.id)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    selectRegion(region.id);
                  }
                }}
                className={`cursor-pointer stroke-2 transition-colors focus-visible:outline-none focus-visible:stroke-[4px] focus-visible:stroke-ring ${
                  selected
                    ? "fill-primary stroke-primary-foreground"
                    : hasDestinations
                      ? "fill-sand stroke-lagoon/45 hover:fill-gold/30"
                      : "fill-sand/50 stroke-ink/20 hover:fill-clay"
                }`}
              >
                <title>{region.name}</title>
              </path>
            );
          })}
        </svg>
      </div>

      <div className="rounded-[1.5rem] border border-ink/10 bg-card p-5 shadow-soft" aria-live="polite">
        {!selectedRegion ? (
          <div className="space-y-3">
            <h2 className="font-heading text-xl font-semibold">{strings.map.selectRegion}</h2>
            <p className="text-sm leading-6 text-muted-foreground">{strings.map.intro}</p>
          </div>
        ) : (
          <div className="space-y-5">
            <div>
              <p className="text-[0.6rem] font-semibold tracking-[0.22em] text-ochre uppercase">
                {selectedRegion.province}
              </p>
              <h2 className="font-heading text-2xl font-semibold tracking-tight">
                {selectedRegion.name}
              </h2>
            </div>

            {selectedDestinations.length === 0 ? (
              <p className="text-sm leading-6 text-muted-foreground">
                {strings.map.noDestinations}
              </p>
            ) : (
              <div className="space-y-5">
                {selectedDestinations.map((destination) => (
                  <article
                    key={destination.id}
                    className="space-y-3 border-t border-border pt-4 first:border-t-0 first:pt-0"
                  >
                    {destination.heroImage ? (
                      <Image
                        src={destination.heroImage}
                        alt={destination.heroImageAlt ?? destination.name}
                        width={640}
                        height={360}
                        className="h-36 w-full rounded-2xl object-cover"
                      />
                    ) : null}
                    <div>
                      <h3 className="font-heading text-lg font-semibold">{destination.name}</h3>
                      <p className="mt-1 text-sm leading-6 text-muted-foreground">
                        {destination.description}
                      </p>
                    </div>
                    {destination.bestSeason ? (
                      <p className="text-xs text-muted-foreground">
                        {strings.map.bestSeason}: {destination.bestSeason}
                      </p>
                    ) : null}
                    {destination.highlights.length > 0 ? (
                      <div className="flex flex-wrap gap-2">
                        {destination.highlights.slice(0, 5).map((highlight) => (
                          <span
                            key={highlight}
                            className="rounded-full border border-ink/10 bg-background/70 px-2.5 py-1 text-xs text-ink/70"
                          >
                            {highlight}
                          </span>
                        ))}
                      </div>
                    ) : null}
                    {destination.packages.length > 0 ? (
                      <div>
                        <p className="text-xs font-medium">{strings.map.packagesHeading}</p>
                        <ul className="mt-1 space-y-1 text-sm">
                          {destination.packages.map((item) => (
                            <li key={item.id}>
                              <Link
                                href={`/packages/${item.slug}`}
                                className="underline underline-offset-2 hover:text-foreground"
                              >
                                {item.title}
                              </Link>
                            </li>
                          ))}
                        </ul>
                      </div>
                    ) : null}
                  </article>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
