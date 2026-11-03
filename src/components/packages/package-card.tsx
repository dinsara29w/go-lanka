"use client";

import Image from "next/image";
import Link from "next/link";

import { useCurrency } from "@/components/currency/currency-provider";
import { fallbackImage } from "@/content/site-images";
import { strings } from "@/content/strings";
import { formatConvertedPrice, formatLkr } from "@/lib/currency";
import type { PublicPackage } from "@/server/repositories/packages";

/** "From US$1,234 (LKR 380,000)": the converted price first, the LKR base in brackets. */
export function PackagePrice({ amountLkr }: { amountLkr: number }) {
  const { currency, rates } = useCurrency();
  const converted = currency === "LKR" ? null : formatConvertedPrice(amountLkr, currency, rates);
  return (
    <span className="font-heading text-[1.1875rem] font-bold text-brand">
      {strings.site.from} {converted ?? formatLkr(amountLkr)}
      {converted ? (
        <span className="ml-1 font-sans text-[0.8125rem] font-medium">
          ({formatLkr(amountLkr)})
        </span>
      ) : null}
    </span>
  );
}

export function PackageCard({ item, index = 0 }: { item: PublicPackage; index?: number }) {
  const fallback = fallbackImage(index);
  return (
    <article className="flex">
      <Link
        href={`/packages/${item.slug}`}
        className="group flex w-full flex-col overflow-hidden rounded-[1.125rem] bg-white shadow-card transition-shadow hover:shadow-lift"
      >
        <span className="zoom-img relative block h-[12.5rem] overflow-hidden">
          <Image
            src={item.heroImage ?? fallback.src}
            alt={item.heroImageAlt ?? (item.heroImage ? item.title : fallback.alt)}
            fill
            sizes="(min-width: 1024px) 340px, (min-width: 640px) 50vw, 100vw"
            className="object-cover"
          />
          <span className="absolute top-3 left-3 rounded-full bg-brand px-[0.6875rem] py-[0.3125rem] text-xs font-semibold text-white uppercase">
            {item.durationDays} {strings.site.days}
          </span>
        </span>
        <span className="flex flex-1 flex-col gap-2 px-5 pt-5 pb-[1.375rem]">
          <span className="font-heading text-[1.1875rem] leading-tight font-bold text-ink">
            {item.title}
          </span>
          <span className="line-clamp-2 text-[0.8125rem] leading-normal text-stone">
            {item.summary}
          </span>
          <span className="mt-auto pt-1">
            <PackagePrice amountLkr={item.basePriceLkr} />
          </span>
        </span>
      </Link>
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
      <div className="mx-auto max-w-2xl rounded-2xl border border-dashed border-line bg-white p-8 text-center">
        <h2 className="font-heading text-xl font-bold text-ink">{emptyTitle}</h2>
        <p className="mt-2 text-sm leading-6 text-stone">{emptyBody}</p>
        <Link href="/contact" className="btn-outline-pill mt-5">
          {strings.nav.contact}
        </Link>
      </div>
    );
  }

  return (
    <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
      {packages.map((item, index) => (
        <PackageCard key={item.id} item={item} index={index} />
      ))}
    </div>
  );
}
