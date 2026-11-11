import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";
import { cn } from "cn";

import { CompassStar, CompassWatermark } from "@/components/brand/compass";
import { strings } from "@/content/strings";
import type { SiteImage } from "@/content/site-images";

/**
 * Section title: compass-star eyebrow, serif heading with an italic accent word.
 * `align="left"` puts an optional `action` (e.g. a "view all" link) on the right.
 */
export function SectionHeading({
  eyebrow,
  title,
  accent,
  intro,
  as: Tag = "h2",
  align = "center",
  action,
  className,
}: {
  eyebrow?: string;
  title: string;
  accent?: string;
  intro?: string;
  as?: "h1" | "h2";
  align?: "center" | "left";
  action?: ReactNode;
  className?: string;
}) {
  const left = align === "left";
  return (
    <div
      className={cn(
        left && "flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between",
        className,
      )}
    >
      <div
        className={cn(
          "flex flex-col gap-3",
          left ? "items-start text-left" : "items-center text-center",
        )}
      >
        {eyebrow ? (
          <p className="inline-flex items-center gap-2 text-xs font-bold tracking-[0.18em] text-teal-deep uppercase">
            <CompassStar className="text-gold" />
            {eyebrow}
          </p>
        ) : null}
        <Tag className="font-heading text-[2rem] leading-[1.1] font-semibold tracking-[-0.01em] text-balance text-ink sm:text-[2.875rem]">
          {title}
          {accent ? (
            <>
              {" "}
              <em className="font-medium text-brand italic">{accent}</em>
            </>
          ) : null}
        </Tag>
        {intro ? (
          <p className="max-w-xl text-[0.9375rem] leading-relaxed text-stone">{intro}</p>
        ) : null}
      </div>
      {action}
    </div>
  );
}

export type Crumb = { href?: string; label: string };

/** Photo banner at the top of every inner page: curved bottom edge and a faint compass. */
export function PageBanner({
  title,
  intro,
  image,
  crumbs,
  imageClassName,
}: {
  title: string;
  intro?: string | null;
  image: SiteImage | { src: string; alt: string };
  crumbs: Crumb[];
  imageClassName?: string;
}) {
  const all: Crumb[] = [{ href: "/", label: strings.site.breadcrumbHome }, ...crumbs];
  return (
    <section className="relative isolate overflow-hidden rounded-b-[2.5rem] bg-navy">
      <Image
        src={image.src}
        alt=""
        fill
        preload
        sizes="100vw"
        className={cn("-z-20 object-cover", imageClassName)}
      />
      <div
        aria-hidden="true"
        className="absolute inset-0 -z-10 bg-[linear-gradient(100deg,rgba(10,37,54,0.92)_0%,rgba(10,37,54,0.72)_48%,rgba(10,37,54,0.3)_100%)]"
      />
      <CompassWatermark className="absolute -right-16 -bottom-24 -z-10 size-80 text-white/12 sm:size-[26rem]" />
      <div className="mx-auto flex min-h-[16rem] max-w-[60rem] flex-col justify-center gap-4 px-4 py-14 sm:min-h-[18.5rem] sm:px-6 lg:px-0">
        <nav aria-label="Breadcrumb">
          <ol className="flex flex-wrap items-center gap-1.5 text-xs font-semibold text-white/90">
            {all.map((crumb, index) => (
              <li key={`${crumb.label}-${index}`} className="flex items-center gap-1.5">
                {index > 0 ? (
                  <span aria-hidden="true" className="text-white/50">
                    ›
                  </span>
                ) : null}
                {crumb.href && index < all.length - 1 ? (
                  <Link
                    href={crumb.href}
                    className="rounded-full bg-white/12 px-3 py-1 backdrop-blur-sm transition-colors hover:bg-white/22"
                  >
                    {crumb.label}
                  </Link>
                ) : (
                  <span
                    aria-current={index === all.length - 1 ? "page" : undefined}
                    className="rounded-full bg-gold px-3 py-1 text-ink"
                  >
                    {crumb.label}
                  </span>
                )}
              </li>
            ))}
          </ol>
        </nav>
        <h1 className="font-heading text-[2.5rem] leading-[1.05] font-semibold tracking-[-0.01em] text-balance text-white sm:text-[3.625rem]">
          {title}
        </h1>
        {intro ? (
          <p className="max-w-[34rem] text-base leading-relaxed text-white/85 sm:text-[1.0625rem]">
            {intro}
          </p>
        ) : null}
      </div>
    </section>
  );
}

/** Call-to-action panel: text on the left, a gold button on the right, compass watermark behind. */
export function CtaBox({
  title,
  body,
  href,
  label,
  className,
}: {
  title: string;
  body: string;
  href: string;
  label: string;
  className?: string;
}) {
  return (
    <section className={cn("px-4 pt-16 pb-20 sm:px-6 sm:pt-[4.5rem]", className)}>
      <div className="relative isolate mx-auto flex max-w-[60rem] flex-col items-start gap-6 overflow-hidden rounded-[2rem] bg-[linear-gradient(120deg,#0b2a3d_0%,#1b4f6b_62%,#2b6a8c_100%)] px-7 py-10 text-white sm:flex-row sm:items-center sm:justify-between sm:gap-10 sm:px-12 sm:py-12">
        <CompassWatermark className="absolute -top-16 -right-16 -z-10 size-80 text-white/10" />
        <div className="max-w-lg">
          <h2 className="font-heading text-[1.875rem] leading-tight font-semibold tracking-[-0.01em] text-balance sm:text-[2.375rem]">
            {title}
          </h2>
          <p className="mt-2.5 text-[0.9375rem] leading-relaxed text-white/80 sm:text-base">
            {body}
          </p>
        </div>
        <Link href={href} className="btn-gold shrink-0">
          {label}
        </Link>
      </div>
    </section>
  );
}

export function Stars({ rating, className }: { rating: number; className?: string }) {
  const filled = Math.max(0, Math.min(5, Math.round(rating)));
  return (
    <span
      className={cn("text-[0.9375rem] tracking-[3px] text-star", className)}
      role="img"
      aria-label={`${filled} ${strings.reviews.outOfFive}`}
    >
      {"★".repeat(filled)}
      <span className="text-line">{"★".repeat(5 - filled)}</span>
    </span>
  );
}

/** White card with a soft shadow. */
export const cardClass = "rounded-2xl border border-line bg-white shadow-card";
