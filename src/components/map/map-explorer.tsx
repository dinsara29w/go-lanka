"use client";

import { useMemo, useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { cn } from "cn";

import { SectionHeading } from "@/components/site/section";
import { fallbackImage } from "@/content/site-images";
import { SRI_LANKA_MAP_VIEWBOX, sriLankaMapRegions } from "@/content/map-regions";
import { strings } from "@/content/strings";
import type { MapDestination } from "@/server/repositories/destinations";

function destinationImage(destination: MapDestination, index: number) {
  return destination.heroImage
    ? { src: destination.heroImage, alt: destination.heroImageAlt ?? destination.name }
    : fallbackImage(index);
}

export function MapExplorer({ destinations }: { destinations: MapDestination[] }) {
  const [selectedRegionId, setSelectedRegionId] = useState<string | null>(null);
  const [regionFilter, setRegionFilter] = useState<string | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const byDistrict = useMemo(() => {
    const map = new Map<string, MapDestination[]>();
    for (const destination of destinations) {
      const list = map.get(destination.mapRegionId) ?? [];
      list.push(destination);
      map.set(destination.mapRegionId, list);
    }
    return map;
  }, [destinations]);

  const regions = useMemo(() => {
    const map = new Map<string, { name: string; items: MapDestination[]; first: number }>();
    destinations.forEach((destination, index) => {
      const entry = map.get(destination.region) ?? {
        name: destination.region,
        items: [],
        first: index,
      };
      entry.items.push(destination);
      map.set(destination.region, entry);
    });
    return [...map.values()];
  }, [destinations]);

  const selectedDistrict = selectedRegionId
    ? sriLankaMapRegions.find((region) => region.id === selectedRegionId)
    : null;

  const visible = destinations
    .map((destination, index) => ({ destination, index }))
    .filter(({ destination }) =>
      selectedRegionId
        ? destination.mapRegionId === selectedRegionId
        : regionFilter
          ? destination.region === regionFilter
          : true,
    );

  function selectDistrict(id: string) {
    setRegionFilter(null);
    setSelectedRegionId((current) => (current === id ? null : id));
  }

  function showRegion(name: string) {
    setSelectedRegionId(null);
    setRegionFilter(name);
    listRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function clearFilters() {
    setSelectedRegionId(null);
    setRegionFilter(null);
  }

  const filterLabel = selectedDistrict?.name ?? regionFilter;

  return (
    <>
      <div
        ref={listRef}
        className="mx-auto grid max-w-[60rem] scroll-mt-24 gap-8 px-4 pt-10 sm:px-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:px-0"
      >
        <div className="self-start rounded-[1.125rem] border border-line bg-white p-5 shadow-card lg:sticky lg:top-24">
          <svg
            viewBox={SRI_LANKA_MAP_VIEWBOX}
            role="group"
            aria-label={strings.map.mapLabel}
            className="mx-auto h-auto max-h-[26rem] w-full"
          >
            {sriLankaMapRegions.map((region) => {
              const count = byDistrict.get(region.id)?.length ?? 0;
              const selected = region.id === selectedRegionId;
              return (
                <path
                  key={region.id}
                  d={region.path}
                  role="button"
                  tabIndex={0}
                  aria-label={`${region.name} ${strings.map.regionLabel}, ${count} ${strings.map.destinationsHeading.toLowerCase()}`}
                  aria-pressed={selected}
                  fillRule="evenodd"
                  vectorEffect="non-scaling-stroke"
                  onClick={() => selectDistrict(region.id)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      selectDistrict(region.id);
                    }
                  }}
                  className={cn(
                    "cursor-pointer stroke-[1.25] transition-colors focus-visible:stroke-[3px] focus-visible:outline-none",
                    selected
                      ? "fill-brand stroke-white"
                      : count > 0
                        ? "fill-[#BFE3CC] stroke-brand/70 hover:fill-amber/70"
                        : "fill-[#DCEFE3] stroke-brand/40 hover:fill-[#BFE3CC]",
                  )}
                >
                  <title>{region.name}</title>
                </path>
              );
            })}
          </svg>
          <p className="mt-3 text-center text-xs text-stone">{strings.map.selectRegion}</p>
        </div>

        <div aria-live="polite">
          {filterLabel ? (
            <div className="mb-3 flex items-center justify-between gap-3">
              <p className="font-heading text-[1.0625rem] font-bold text-ink">{filterLabel}</p>
              <button
                type="button"
                onClick={clearFilters}
                className="text-sm font-semibold text-brand hover:underline"
              >
                {strings.map.showAll}
              </button>
            </div>
          ) : null}

          {visible.length === 0 ? (
            <p className="rounded-2xl border border-dashed border-line bg-white p-5 text-sm leading-6 text-stone">
              {destinations.length === 0 ? strings.map.empty : strings.map.noDestinations}
            </p>
          ) : (
            <ul className="flex flex-col gap-3.5">
              {visible.map(({ destination, index }) => {
                const image = destinationImage(destination, index);
                const open = openId === destination.id;
                const count = destination.packages.length;
                return (
                  <li
                    key={destination.id}
                    className={cn(
                      "rounded-2xl border bg-white transition-colors",
                      open ? "border-brand" : "border-line",
                    )}
                  >
                    <button
                      type="button"
                      aria-expanded={open}
                      onClick={() => {
                        setOpenId(open ? null : destination.id);
                        if (!regionFilter)
                          setSelectedRegionId(open ? null : destination.mapRegionId);
                      }}
                      className="flex w-full items-center gap-4 p-3 text-left"
                    >
                      <span className="relative block h-[4.5rem] w-[6.25rem] shrink-0 overflow-hidden rounded-lg">
                        <Image
                          src={image.src}
                          alt={image.alt}
                          fill
                          sizes="100px"
                          className="object-cover"
                        />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block font-heading text-[1.0625rem] font-bold text-ink">
                          {destination.name}
                        </span>
                        <span className="mt-0.5 line-clamp-2 block text-[0.8125rem] leading-normal text-stone">
                          {destination.description}
                        </span>
                      </span>
                      <span className="shrink-0 text-xs font-semibold text-brand">
                        {count} {count === 1 ? strings.site.journey : strings.site.journeys}
                      </span>
                    </button>

                    {open ? (
                      <div className="space-y-3 border-t border-line px-4 pt-3 pb-4 text-sm">
                        {destination.bestSeason ? (
                          <p className="text-stone">
                            <b className="text-ink">{strings.map.bestSeason}:</b>{" "}
                            {destination.bestSeason}
                          </p>
                        ) : null}
                        {destination.highlights.length > 0 ? (
                          <ul className="flex flex-wrap gap-2">
                            {destination.highlights.slice(0, 5).map((highlight) => (
                              <li
                                key={highlight}
                                className="rounded-full bg-tint px-3 py-1 text-xs font-semibold text-brand"
                              >
                                {highlight}
                              </li>
                            ))}
                          </ul>
                        ) : null}
                        {count > 0 ? (
                          <div>
                            <p className="text-xs font-semibold text-ink">
                              {strings.map.packagesHeading}
                            </p>
                            <ul className="mt-1.5 space-y-1">
                              {destination.packages.map((item) => (
                                <li key={item.id}>
                                  <Link
                                    href={`/packages/${item.slug}`}
                                    className="font-medium text-brand hover:underline"
                                  >
                                    {item.title}
                                  </Link>
                                </li>
                              ))}
                            </ul>
                          </div>
                        ) : null}
                      </div>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>

      {regions.length > 1 ? (
        <section className="px-4 pt-[4.5rem] sm:px-6">
          <SectionHeading
            eyebrow={strings.map.regionsEyebrow}
            title={strings.map.regionsHeading}
            accent={strings.map.regionsAccent}
          />
          <div className="mx-auto mt-8 flex max-w-[60rem] flex-wrap justify-center gap-4">
            {regions.map((region) => {
              const image = destinationImage(region.items[0], region.first);
              return (
                <button
                  key={region.name}
                  type="button"
                  onClick={() => showRegion(region.name)}
                  className="zoom-img relative block h-48 w-[calc(50%-0.5rem)] overflow-hidden rounded-2xl text-left lg:w-[calc(25%-0.75rem)] shadow-[0_4px_22px_rgba(16,33,26,0.1)] sm:h-[13.75rem]"
                >
                  <Image
                    src={image.src}
                    alt=""
                    fill
                    sizes="(min-width: 1024px) 230px, 50vw"
                    className="object-cover"
                  />
                  <span
                    aria-hidden="true"
                    className="absolute inset-0 bg-[linear-gradient(0deg,rgba(16,33,26,0.8),rgba(16,33,26,0)_55%)]"
                  />
                  <span className="absolute inset-x-4 bottom-4 text-white">
                    <span className="block font-heading text-lg font-bold">{region.name}</span>
                    <span className="mt-0.5 line-clamp-2 block text-xs text-white/85">
                      {region.items.map((item) => item.name).join(", ")}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
        </section>
      ) : null}
    </>
  );
}
