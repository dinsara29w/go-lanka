import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import { cn } from "cn";

import { AutoSubmitSelect } from "@/components/packages/auto-submit-select";
import { PackageGrid } from "@/components/packages/package-card";
import { CtaBox, PageBanner } from "@/components/site/section";
import { JsonLd } from "@/components/seo/json-ld";
import { siteImages } from "@/content/site-images";
import { strings } from "@/content/strings";
import { getSiteUrl } from "@/lib/site";
import {
  getPackageFilterOptions,
  listPublishedPackages,
  type PackageFilters,
} from "@/server/repositories/packages";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Tour packages",
  description: "Browse published Sri Lanka tour packages and request a direct quote.",
  alternates: { canonical: "/packages" },
};

const durationOptions = [
  { value: "1-3", label: strings.packages.duration1to3 },
  { value: "4-7", label: strings.packages.duration4to7 },
  { value: "8-14", label: strings.packages.duration8to14 },
  { value: "15-plus", label: strings.packages.duration15plus },
];

const selectClass = "field h-10 w-auto min-w-[9.5rem] text-sm";

function packagesHref(filters: PackageFilters, change: Partial<PackageFilters>): string {
  const next = { ...filters, ...change };
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(next)) if (value) params.set(key, value);
  const query = params.toString();
  return query ? `/packages?${query}` : "/packages";
}

export default async function PackagesPage({
  searchParams,
}: {
  searchParams: Promise<{ destination?: string; activity?: string; duration?: string }>;
}) {
  const params = await searchParams;
  const siteUrl = getSiteUrl();
  const filters: PackageFilters = {
    destination: typeof params.destination === "string" ? params.destination : undefined,
    activity: typeof params.activity === "string" ? params.activity : undefined,
    duration: typeof params.duration === "string" ? params.duration : undefined,
  };

  return (
    <>
      <PageBanner
        title={strings.packages.heading}
        intro={strings.packages.intro}
        image={siteImages.ellaHills}
        crumbs={[{ label: strings.nav.packages }]}
      />

      <div className="mx-auto max-w-[60rem] px-4 pt-10 sm:px-6 lg:px-0">
        <Suspense fallback={<CatalogueLoading />}>
          <PackageCatalogue filters={filters} />
        </Suspense>
      </div>

      <CtaBox
        title={strings.packages.ctaHeading}
        body={strings.packages.ctaBody}
        href="/tour-builder"
        label={strings.packages.ctaButton}
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
          ],
        }}
      />
    </>
  );
}

function CatalogueLoading() {
  return (
    <div aria-busy="true" aria-live="polite">
      <span className="sr-only">{strings.common.loading}</span>
      <div className="h-10 w-2/3 animate-pulse rounded-full bg-band" />
      <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 3 }).map((_, index) => (
          <div key={index} className="h-80 animate-pulse rounded-[1.125rem] bg-band" />
        ))}
      </div>
    </div>
  );
}

async function PackageCatalogue({ filters }: { filters: PackageFilters }) {
  const [packages, options] = await Promise.all([
    listPublishedPackages(48, filters),
    getPackageFilterOptions(),
  ]);

  const chipClass = (active: boolean) =>
    cn(
      "inline-flex h-10 items-center rounded-full px-4 text-sm font-semibold transition-colors",
      active
        ? "bg-brand text-white"
        : "border border-line bg-white text-ink hover:border-brand hover:text-brand",
    );

  return (
    <>
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <nav aria-label={strings.packages.activityFilter} className="flex flex-wrap gap-2.5">
          <Link
            href={packagesHref(filters, { activity: undefined })}
            aria-current={!filters.activity ? "page" : undefined}
            className={chipClass(!filters.activity)}
          >
            {strings.packages.allJourneys}
          </Link>
          {options.activities.map((activity) => (
            <Link
              key={activity}
              href={packagesHref(filters, { activity })}
              aria-current={filters.activity === activity ? "page" : undefined}
              className={chipClass(filters.activity === activity)}
            >
              {activity}
            </Link>
          ))}
        </nav>

        <form method="get" action="/packages" className="flex flex-wrap items-center gap-2.5">
          {filters.activity ? (
            <input type="hidden" name="activity" value={filters.activity} />
          ) : null}
          <span className="text-sm text-stone" aria-live="polite">
            {packages.length} {packages.length === 1 ? strings.site.journey : strings.site.journeys}
          </span>
          <label>
            <span className="sr-only">{strings.packages.destinationFilter}</span>
            <AutoSubmitSelect
              name="destination"
              defaultValue={filters.destination ?? ""}
              className={selectClass}
            >
              <option value="">{strings.packages.allDestinations}</option>
              {options.destinations.map((destination) => (
                <option key={destination.id} value={destination.slug}>
                  {destination.name}
                </option>
              ))}
            </AutoSubmitSelect>
          </label>
          <label>
            <span className="sr-only">{strings.packages.durationFilter}</span>
            <AutoSubmitSelect
              name="duration"
              defaultValue={filters.duration ?? ""}
              className={selectClass}
            >
              <option value="">{strings.packages.anyDuration}</option>
              {durationOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </AutoSubmitSelect>
          </label>
          <noscript>
            <button type="submit" className="btn-outline h-10 px-4 text-sm">
              {strings.packages.applyFilters}
            </button>
          </noscript>
        </form>
      </div>

      <div className="mt-8">
        <PackageGrid packages={packages} />
      </div>
    </>
  );
}
