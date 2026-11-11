import Image from "next/image";
import Link from "next/link";
import { Plus } from "lucide-react";
import { cn } from "cn";

import type { SiteImage } from "@/content/site-images";
import { strings } from "@/content/strings";

export type MosaicPlace = { slug: string; name: string; region: string; image: SiteImage };

/**
 * Up to eight places: one big tile, then smaller ones, with the last one wide so the grid
 * is always full. Each tile opens the AI tour builder with that place already picked.
 */
export function DestinationMosaic({ places }: { places: MosaicPlace[] }) {
  return (
    <div className="grid auto-rows-[11rem] grid-cols-2 gap-4 md:auto-rows-[13rem] md:grid-cols-4">
      {places.slice(0, 8).map((place, index) => {
        const big = index === 0;
        const wide = index === 7;
        return (
          <Link
            key={place.slug}
            href={`/tour-builder?places=${place.slug}`}
            className={cn(
              "group zoom-img relative overflow-hidden rounded-3xl shadow-card",
              big && "col-span-2 row-span-2",
              wide && "col-span-2",
            )}
          >
            <Image
              src={place.image.src}
              alt={place.image.alt}
              fill
              sizes={
                big || wide ? "(min-width: 768px) 600px, 100vw" : "(min-width: 768px) 300px, 50vw"
              }
              className="object-cover"
            />
            <span
              aria-hidden="true"
              className="absolute inset-0 bg-[linear-gradient(0deg,rgba(11,42,61,0.82),rgba(11,42,61,0)_58%)]"
            />
            <span className="absolute inset-x-4 bottom-4 flex items-end justify-between gap-3 text-white">
              <span>
                <span
                  className={cn(
                    "block font-heading leading-tight font-bold",
                    big ? "text-3xl" : "text-xl",
                  )}
                >
                  {place.name}
                </span>
                <span className="mt-0.5 block text-xs text-white/80">{place.region}</span>
              </span>
              <span className="hidden items-center gap-1 rounded-full bg-gold px-3 py-1.5 text-xs font-bold text-ink opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100 md:inline-flex">
                <Plus aria-hidden="true" className="size-3.5" />
                {strings.home.planHere}
              </span>
            </span>
          </Link>
        );
      })}
    </div>
  );
}
