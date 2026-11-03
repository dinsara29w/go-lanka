import Image from "next/image";
import Link from "next/link";
import { cn } from "cn";

import { strings } from "@/content/strings";
import type { SiteImage } from "@/content/site-images";

/** Small-caps eyebrow, 38–40px heading with a gradient last word and a 44×3 amber underline. */
export function SectionHeading({
  eyebrow,
  title,
  accent,
  intro,
  as: Tag = "h2",
  className,
}: {
  eyebrow?: string;
  title: string;
  accent?: string;
  intro?: string;
  as?: "h1" | "h2";
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col items-center gap-2.5 text-center", className)}>
      {eyebrow ? (
        <p className="text-xs font-semibold tracking-[0.16em] text-brand uppercase">{eyebrow}</p>
      ) : null}
      <Tag className="font-heading text-[1.875rem] leading-[1.12] font-extrabold tracking-[-0.02em] text-ink sm:text-[2.5rem]">
        {title}
        {accent ? (
          <>
            {" "}
            <span className="text-gradient">{accent}</span>
          </>
        ) : null}
      </Tag>
      <span aria-hidden="true" className="h-[3px] w-11 rounded-full bg-amber" />
      {intro ? <p className="mt-1 max-w-xl text-[0.9375rem] text-stone">{intro}</p> : null}
    </div>
  );
}

export type Crumb = { href?: string; label: string };

/** Photo banner used at the top of every inner page. */
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
    <section className="relative isolate overflow-hidden bg-brand-dark">
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
        className="absolute inset-0 -z-10 bg-[linear-gradient(90deg,rgba(6,40,26,0.78)_0%,rgba(6,40,26,0.55)_55%,rgba(6,40,26,0.4)_100%)]"
      />
      <div className="mx-auto flex min-h-[15rem] max-w-[60rem] flex-col justify-center gap-3 px-4 py-14 sm:min-h-[17.5rem] sm:px-6 lg:px-0">
        <nav aria-label="Breadcrumb">
          <ol className="flex flex-wrap items-center gap-1 text-[0.8125rem] text-white/85">
            {all.map((crumb, index) => (
              <li key={`${crumb.label}-${index}`} className="flex items-center gap-1">
                {index > 0 ? <span aria-hidden="true">/</span> : null}
                {crumb.href && index < all.length - 1 ? (
                  <Link href={crumb.href} className="hover:text-white hover:underline">
                    {crumb.label}
                  </Link>
                ) : (
                  <span aria-current={index === all.length - 1 ? "page" : undefined}>
                    {crumb.label}
                  </span>
                )}
              </li>
            ))}
          </ol>
        </nav>
        <h1 className="font-heading text-[2.25rem] leading-[1.08] font-extrabold tracking-[-0.025em] text-balance text-white sm:text-[2.875rem]">
          {title}
        </h1>
        {intro ? (
          <p className="max-w-[34rem] text-base leading-[1.55] text-[#E3F2EA] sm:text-[1.0625rem]">
            {intro}
          </p>
        ) : null}
      </div>
    </section>
  );
}

/** Green gradient call-to-action box with a white pill button. */
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
      <div className="mx-auto flex max-w-[47.5rem] flex-col items-center gap-3 rounded-3xl bg-[linear-gradient(135deg,#14935A,#0A5A36)] px-6 py-11 text-center text-white shadow-[0_6px_0_#06432A] sm:px-10 sm:py-[3.25rem]">
        <h2 className="font-heading text-[1.75rem] font-extrabold tracking-[-0.02em] text-balance sm:text-[2.125rem]">
          {title}
        </h2>
        <p className="text-[0.9375rem] text-[#D9F0E3] sm:text-base">{body}</p>
        <Link href={href} className="btn-pill-white mt-2.5">
          {label}
        </Link>
      </div>
    </section>
  );
}

/** Five filled dots used as a compact rating mark (decorative). */
export function RatingDots({ className }: { className?: string }) {
  return (
    <span aria-hidden="true" className={cn("tracking-[4px] text-brand", className)}>
      ●●●●●
    </span>
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

/** White card with the design's soft shadow. */
export const cardClass = "rounded-2xl border border-line bg-white shadow-card";
