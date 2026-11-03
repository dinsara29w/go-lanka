import Link from "next/link";
import Image from "next/image";
import { ArrowRight, CalendarDays, MapPin } from "lucide-react";

import { BrandMark } from "@/components/brand/brand-mark";
import { Price } from "@/components/currency/currency-provider";
import { Button } from "@/components/ui/button";
import { strings } from "@/content/strings";
import { formatDuration } from "@/lib/currency";
import type { PublicPackage } from "@/server/repositories/packages";

export function PackageCard({ item }: { item: PublicPackage }) {
  return (
    <article className="group flex h-full flex-col overflow-hidden rounded-[1.75rem] border border-ink/10 bg-card shadow-soft transition-[transform,box-shadow] duration-300 hover:-translate-y-1 hover:shadow-lift motion-reduce:transition-none motion-reduce:hover:translate-y-0">
      <Link
        href={`/packages/${item.slug}`}
        className="relative block h-52 overflow-hidden focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-ring"
      >
        {item.heroImage ? (
          <>
            <Image
              src={item.heroImage}
              alt={item.heroImageAlt ?? item.title}
              width={640}
              height={400}
              sizes="(min-width: 1024px) 33vw, (min-width: 768px) 50vw, 100vw"
              className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-[1.04] motion-reduce:transition-none"
            />
            <span
              aria-hidden="true"
              className="absolute inset-0 bg-gradient-to-t from-ocean-deep/45 via-transparent to-transparent"
            />
          </>
        ) : (
          <div className="relative flex h-full items-center justify-center overflow-hidden bg-ocean-deep">
            <div
              aria-hidden="true"
              className="absolute inset-0 bg-[radial-gradient(circle_at_50%_115%,rgba(201,150,43,0.55),transparent_58%)]"
            />
            <div
              aria-hidden="true"
              className="absolute inset-x-6 top-6 bottom-0 rounded-t-full border border-ivory/15"
            />
            <BrandMark className="relative size-24 text-ivory/30" />
            <span className="absolute bottom-4 left-4 rounded-full bg-ivory/90 px-3 py-1 text-[0.6rem] font-semibold tracking-[0.2em] text-ocean uppercase">
              Ceylon
            </span>
          </div>
        )}

        {item.featured ? (
          <span className="absolute top-4 left-4 rounded-full bg-gold px-3 py-1 text-[0.6rem] font-semibold tracking-[0.18em] text-ocean-deep uppercase shadow-soft">
            {strings.packages.featuredLabel}
          </span>
        ) : null}
      </Link>

      <div className="flex flex-1 flex-col gap-4 p-6">
        <div className="space-y-2.5">
          <p className="flex items-center gap-2 text-[0.6rem] font-semibold tracking-[0.22em] text-ochre uppercase">
            <span aria-hidden="true" className="h-px w-5 bg-gold/60" />
            {item.activities[0] ?? strings.nav.packages}
          </p>
          <h2 className="font-heading text-[1.4rem] leading-snug font-semibold tracking-tight">
            <Link href={`/packages/${item.slug}`} className="transition-colors hover:text-ocean">
              {item.title}
            </Link>
          </h2>
          <p className="line-clamp-2 text-sm leading-6 text-muted-foreground">{item.summary}</p>
        </div>

        <div className="flex flex-wrap gap-2 text-xs text-ink/70">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-sand px-2.5 py-1">
            <CalendarDays aria-hidden="true" className="size-3.5 text-ocean/70" />
            {formatDuration(item.durationDays)}
          </span>
          {item.activities.slice(0, 2).map((activity) => (
            <span key={activity} className="inline-flex items-center gap-1.5 rounded-full bg-sand px-2.5 py-1">
              <MapPin aria-hidden="true" className="size-3.5 text-ocean/70" />
              {activity}
            </span>
          ))}
        </div>

        <div className="mt-auto flex items-end justify-between gap-4 border-t border-ink/10 pt-5">
          <p className="text-[0.6rem] font-semibold tracking-[0.18em] text-muted-foreground uppercase">
            {strings.packages.from}
            <span className="mt-1 block font-heading text-xl font-semibold tracking-normal text-ocean normal-case">
              <Price amountLkr={item.basePriceLkr} />
            </span>
          </p>
          <Button asChild variant="outline" className="rounded-full">
            <Link href={`/packages/${item.slug}`}>
              {strings.packages.viewDetails}
              <ArrowRight aria-hidden="true" />
            </Link>
          </Button>
        </div>
      </div>
    </article>
  );
}

export function PackageGrid({
  packages,
  emptyTitle = strings.packages.emptyTitle,
  emptyBody = strings.packages.emptyBody,
}: {
  packages: PublicPackage[];
  emptyTitle?: string;
  emptyBody?: string;
}) {
  if (packages.length === 0) {
    return (
      <div className="relative overflow-hidden rounded-[1.75rem] border border-dashed border-ink/20 bg-card/60 p-8 sm:p-10">
        <div
          aria-hidden="true"
          className="absolute -top-16 -right-10 size-40 rounded-full border border-gold/15"
        />
        <div className="relative flex flex-col gap-6 sm:flex-row sm:items-start">
          <span className="flex size-16 shrink-0 items-center justify-center rounded-full bg-ocean/5 text-ocean/40 ring-1 ring-ocean/10">
            <BrandMark className="size-9" />
          </span>
          <div>
            <h2 className="font-heading text-xl font-semibold">{emptyTitle}</h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">{emptyBody}</p>
            <Button asChild className="mt-5 rounded-full" variant="outline">
              <Link href="/contact">{strings.nav.contact}</Link>
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
      {packages.map((item) => (
        <PackageCard key={item.id} item={item} />
      ))}
    </div>
  );
}
