"use client";

import Image from "next/image";
import Link from "next/link";
import { ArrowUpRight, Clock3 } from "lucide-react";

import { useCurrency } from "@/components/currency/currency-provider";
import { fallbackImage } from "@/content/site-images";
import { strings } from "@/content/strings";
import { formatConvertedPrice, formatLkr } from "@/lib/currency";
import type { PublicPackage } from "@/server/repositories/packages";

/** Stacked price: "From" label, the converted price, and the LKR base underneath. */
export function PackagePrice({ amountLkr }: { amountLkr: number }) {
  const { currency, rates } = useCurrency();
  const converted = currency === "LKR" ? null : formatConvertedPrice(amountLkr, currency, rates);
  return (
    <span className="flex flex-col leading-tight">
      <span className="text-[0.6875rem] font-bold tracking-[0.14em] text-stone uppercase">
        {strings.site.from}
      </span>
      <span className="font-heading text-[1.375rem] font-semibold text-ink">
        {converted ?? formatLkr(amountLkr)}
      </span>
      {converted ? <span className="text-xs text-stone">{formatLkr(amountLkr)}</span> : null}
    </span>
  );
}

export function PackageCard({ item, index = 0 }: { item: PublicPackage; index?: number }) {
  const fallback = fallbackImage(index);
  return (
    <article className="flex">
      <Link
        href={`/packages/${item.slug}`}
        className="group flex w-full flex-col rounded-[1.75rem] bg-white p-2.5 shadow-card ring-1 ring-line/70 transition duration-300 hover:-translate-y-1 hover:shadow-lift motion-reduce:transition-none motion-reduce:hover:translate-y-0"
      >
        <span className="zoom-img relative block h-52 overflow-hidden rounded-[1.25rem]">
          <Image
            src={item.heroImage ?? fallback.src}
            alt={item.heroImageAlt ?? (item.heroImage ? item.title : fallback.alt)}
            fill
            sizes="(min-width: 1024px) 340px, (min-width: 640px) 50vw, 100vw"
            className="object-cover"
          />
          <span
            aria-hidden="true"
            className="absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-navy/45 to-transparent"
          />
          <span className="absolute top-3 left-3 inline-flex items-center gap-1.5 rounded-full bg-gold px-3 py-1 text-xs font-bold text-ink shadow-sm">
            <Clock3 aria-hidden="true" className="size-3.5" />
            {item.durationDays} {strings.site.days}
          </span>
        </span>
        <span className="flex flex-1 flex-col gap-2 px-3.5 pt-4 pb-3">
          <span className="font-heading text-[1.25rem] leading-snug font-semibold text-ink">
            {item.title}
          </span>
          <span className="line-clamp-2 text-[0.8125rem] leading-relaxed text-stone">
            {item.summary}
          </span>
          <span className="mt-auto flex items-end justify-between gap-3 border-t border-dashed border-line pt-3.5">
            <PackagePrice amountLkr={item.basePriceLkr} />
            <span
              aria-hidden="true"
              className="flex size-10 shrink-0 items-center justify-center rounded-full bg-tint text-brand transition-colors group-hover:bg-brand group-hover:text-white"
            >
              <ArrowUpRight className="size-5" />
            </span>
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
        <h2 className="font-heading text-xl font-semibold text-ink">{emptyTitle}</h2>
        <p className="mt-2 text-sm leading-6 text-stone">{emptyBody}</p>
        <Link href="/contact" className="btn-outline mt-5">
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
