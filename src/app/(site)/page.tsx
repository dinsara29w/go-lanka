import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { ArrowRight, Compass, MessagesSquare, Route } from "lucide-react";

import { HeroArt } from "@/components/home/hero-art";
import { MapExplorer } from "@/components/map/map-explorer";
import { PackageGrid } from "@/components/packages/package-card";
import { Button } from "@/components/ui/button";
import { strings } from "@/content/strings";
import { listMapDestinations } from "@/server/repositories/destinations";
import { listFeaturedPackages } from "@/server/repositories/packages";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  description: strings.home.description,
  alternates: { canonical: "/" },
};

const highlightIcons = [Compass, MessagesSquare, Route];

export default function HomePage() {
  const [titleLead, titleAccent] = strings.home.title.split(" with ");

  return (
    <>
      <section className="relative overflow-hidden">
        <div
          aria-hidden="true"
          className="absolute inset-0 -z-10 bg-[radial-gradient(60rem_36rem_at_8%_-10%,var(--color-sand),transparent_60%),radial-gradient(48rem_30rem_at_90%_0%,rgba(14,79,74,0.08),transparent_55%)]"
        />
        <div className="mx-auto grid max-w-6xl gap-14 px-4 py-14 sm:px-6 sm:py-20 lg:grid-cols-[1.05fr_0.95fr] lg:items-center lg:gap-10 lg:py-24">
          <div className="animate-rise space-y-8">
            <p className="flex items-center gap-3 text-[0.65rem] font-semibold tracking-[0.3em] text-ochre uppercase">
              <span aria-hidden="true" className="h-px w-10 bg-gold/70" />
              {strings.home.eyebrow}
            </p>
            <h1 className="max-w-2xl font-heading text-[2.15rem] leading-[1.05] font-semibold tracking-tight sm:text-6xl lg:text-[4rem]">
              {titleAccent ? (
                <>
                  <span className="block">{titleLead}</span>
                  <span className="block text-ocean italic">with {titleAccent}</span>
                </>
              ) : (
                strings.home.title
              )}
            </h1>
            <p className="max-w-xl text-base leading-8 text-muted-foreground sm:text-lg">
              {strings.home.description}
            </p>
            <div className="flex flex-col gap-3 sm:flex-row">
              <Button asChild size="xl" className="rounded-full">
                <Link href="/packages">
                  {strings.home.primaryCta}
                  <ArrowRight aria-hidden="true" />
                </Link>
              </Button>
              <Button asChild size="xl" variant="outline" className="rounded-full">
                <Link href="/tour-builder">{strings.home.secondaryCta}</Link>
              </Button>
            </div>
            <dl className="grid max-w-xl grid-cols-3 gap-4 border-t border-ink/10 pt-6">
              {strings.home.highlights.map((highlight, index) => (
                <div key={highlight.title}>
                  <dt className="font-heading text-sm font-semibold text-ocean">
                    0{index + 1}
                  </dt>
                  <dd className="mt-1 text-xs leading-5 text-muted-foreground">{highlight.title}</dd>
                </div>
              ))}
            </dl>
          </div>

          <HeroArt />
        </div>
      </section>

      <section className="border-y border-ink/10 bg-sand/50">
        <div className="mx-auto grid max-w-6xl gap-5 px-4 py-14 sm:px-6 sm:py-16 md:grid-cols-3">
          {strings.home.highlights.map((highlight, index) => {
            const Icon = highlightIcons[index] ?? Compass;
            return (
              <article
                key={highlight.title}
                className="relative overflow-hidden rounded-[1.75rem] border border-ink/10 bg-card/80 p-7 shadow-soft"
              >
                <span
                  aria-hidden="true"
                  className="absolute top-5 right-5 font-heading text-5xl leading-none font-semibold text-gold/15 select-none"
                >
                  0{index + 1}
                </span>
                <span className="flex size-11 items-center justify-center rounded-full bg-ocean/5 text-ocean ring-1 ring-ocean/10">
                  <Icon aria-hidden="true" className="size-5" />
                </span>
                <h2 className="mt-6 font-heading text-xl font-semibold tracking-tight">
                  {highlight.title}
                </h2>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                  {highlight.description}
                </p>
              </article>
            );
          })}
        </div>
      </section>

      <Suspense fallback={<HomeJourneysLoading />}>
        <HomeJourneys />
      </Suspense>

      <section className="mx-auto max-w-6xl px-4 pb-20 sm:px-6">
        <div className="relative overflow-hidden rounded-[2rem] bg-ocean-deep px-6 py-14 text-ivory sm:px-12 sm:py-16">
          <div aria-hidden="true" className="pointer-events-none absolute inset-0">
            <div className="absolute -top-24 -right-16 size-72 rounded-full border border-gold/20" />
            <div className="absolute -top-16 -right-8 size-52 rounded-full border border-gold/20" />
            <div className="absolute -bottom-28 left-[-4rem] size-72 rounded-full bg-[radial-gradient(circle,rgba(201,150,43,0.18),transparent_65%)]" />
          </div>
          <div className="relative max-w-2xl space-y-4">
            <p className="flex items-center gap-3 text-[0.65rem] font-semibold tracking-[0.3em] text-gold-light uppercase">
              <span aria-hidden="true" className="h-px w-8 bg-gold/70" />
              Ceylon
            </p>
            <h2 className="font-heading text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
              {strings.packages.enquiryHeading}
            </h2>
            <p className="text-sm leading-7 text-ivory/75 sm:text-base">
              {strings.packages.enquiryBody}
            </p>
            <div className="flex flex-wrap gap-3 pt-2">
              <Button asChild size="lg" className="rounded-full bg-ivory text-ocean hover:bg-sand">
                <Link href="/contact">{strings.packages.enquiryCta}</Link>
              </Button>
              <Button
                asChild
                size="lg"
                variant="outline"
                className="rounded-full border-ivory/30 bg-transparent text-ivory hover:bg-ivory/10 hover:text-ivory"
              >
                <Link href="/tour-builder">{strings.home.secondaryCta}</Link>
              </Button>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}

function HomeJourneysLoading() {
  return (
    <div
      className="mx-auto max-w-6xl px-4 py-16 sm:px-6"
      aria-busy="true"
      aria-live="polite"
    >
      <span className="sr-only">{strings.common.loading}</span>
      <div className="h-7 w-48 animate-pulse rounded-full bg-sand" />
      <div className="mt-6 h-96 animate-pulse rounded-[2rem] border border-ink/10 bg-sand/60" />
    </div>
  );
}

async function HomeJourneys() {
  const [featuredPackages, mapDestinations] = await Promise.all([
    listFeaturedPackages(3),
    listMapDestinations(),
  ]);

  return (
    <>
      <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-20">
        <div className="rounded-[2rem] border border-ink/10 bg-sand/40 p-4 sm:p-8 lg:p-10">
          <div className="mb-8 flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
            <div className="space-y-3">
              <p className="flex items-center gap-3 text-[0.65rem] font-semibold tracking-[0.3em] text-ochre uppercase">
                <span aria-hidden="true" className="h-px w-8 bg-gold/70" />
                {strings.footer.exploreHeading}
              </p>
              <h2 className="font-heading text-3xl font-semibold tracking-tight sm:text-4xl">
                {strings.map.heading}
              </h2>
              <p className="max-w-2xl text-sm leading-6 text-muted-foreground">
                {strings.map.intro}
              </p>
            </div>
            <Button asChild variant="outline" className="w-fit rounded-full">
              <Link href="/map">
                {strings.map.viewFullMap}
                <ArrowRight aria-hidden="true" />
              </Link>
            </Button>
          </div>
          <MapExplorer destinations={mapDestinations} compact />
        </div>
      </section>

      <section className="border-t border-ink/10 bg-sand/30">
        <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-20">
          <div className="mb-9 flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
            <div className="space-y-3">
              <p className="flex items-center gap-3 text-[0.65rem] font-semibold tracking-[0.3em] text-ochre uppercase">
                <span aria-hidden="true" className="h-px w-8 bg-gold/70" />
                {strings.nav.packages}
              </p>
              <h2 className="font-heading text-3xl font-semibold tracking-tight sm:text-4xl">
                {strings.home.featuredHeading}
              </h2>
              <p className="max-w-2xl text-sm leading-6 text-muted-foreground">
                {featuredPackages.length === 0
                  ? strings.home.featuredEmpty
                  : strings.home.description}
              </p>
            </div>
            <Button asChild variant="outline" className="w-fit rounded-full">
              <Link href="/packages">
                {strings.home.viewAllPackages}
                <ArrowRight aria-hidden="true" />
              </Link>
            </Button>
          </div>
          <PackageGrid packages={featuredPackages} />
        </div>
      </section>
    </>
  );
}
