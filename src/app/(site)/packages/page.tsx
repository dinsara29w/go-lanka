import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import { PackageGrid } from "@/components/packages/package-card";
import { JsonLd } from "@/components/seo/json-ld";
import { Button } from "@/components/ui/button";
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

const selectClass =
  "mt-1.5 w-full rounded-lg border border-input bg-background px-3 py-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/30";

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
    <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-20">
      <div className="max-w-2xl space-y-4">
        <p className="text-sm font-medium text-muted-foreground">{strings.nav.packages}</p>
        <h1 className="font-heading text-4xl font-semibold tracking-tight sm:text-5xl">
          {strings.packages.heading}
        </h1>
        <p className="text-base leading-7 text-muted-foreground">{strings.packages.intro}</p>
      </div>

      <Suspense fallback={<CatalogueLoading />}>
        <PackageCatalogue filters={filters} />
      </Suspense>

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
    </div>
  );
}

function CatalogueLoading() {
  return (
    <div className="mt-10" aria-busy="true" aria-live="polite">
      <span className="sr-only">{strings.common.loading}</span>
      <div className="h-40 animate-pulse rounded-2xl border border-border bg-muted/50" />
      <div className="mt-8 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 3 }).map((_, index) => (
          <div
            key={index}
            className="h-80 animate-pulse rounded-2xl border border-border bg-muted/50"
          />
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

  const hasFilters = Boolean(filters.destination || filters.activity || filters.duration);

  return (
    <>
      <form
        method="get"
        action="/packages"
        className="mt-10 rounded-2xl border border-border bg-card p-4 sm:p-5"
      >
        <p className="font-heading text-sm font-semibold">{strings.packages.filtersHeading}</p>
        <div className="mt-4 grid gap-4 sm:grid-cols-3">
          <div>
            <label htmlFor="filter-destination" className="text-xs font-medium">
              {strings.packages.destinationFilter}
            </label>
            <select
              id="filter-destination"
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
            </select>
          </div>

          <div>
            <label htmlFor="filter-activity" className="text-xs font-medium">
              {strings.packages.activityFilter}
            </label>
            <select
              id="filter-activity"
              name="activity"
              defaultValue={filters.activity ?? ""}
              className={selectClass}
            >
              <option value="">{strings.packages.allActivities}</option>
              {options.activities.map((activity) => (
                <option key={activity} value={activity}>
                  {activity}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="filter-duration" className="text-xs font-medium">
              {strings.packages.durationFilter}
            </label>
            <select
              id="filter-duration"
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
            </select>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-3">
          <Button type="submit">{strings.packages.applyFilters}</Button>
          {hasFilters ? (
            <Button asChild variant="outline">
              <Link href="/packages">{strings.packages.clearFilters}</Link>
            </Button>
          ) : null}
        </div>
      </form>

      <div className="mt-8">
        <PackageGrid packages={packages} />
      </div>
    </>
  );
}
