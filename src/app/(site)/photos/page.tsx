import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { cn } from "cn";

import { PhotoSubmissionForm } from "@/components/photos/photo-submission-form";
import { CtaBox, PageBanner } from "@/components/site/section";
import { siteImages } from "@/content/site-images";
import { strings } from "@/content/strings";
import { listApprovedPhotos } from "@/server/repositories/photos";
import { listPublishedPackageOptions } from "@/server/repositories/packages";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Gallery",
  description: "Approved photos from travellers exploring Sri Lanka.",
  alternates: { canonical: "/photos" },
};

export default async function PhotosPage({
  searchParams,
}: {
  searchParams: Promise<{ journey?: string }>;
}) {
  const { journey } = await searchParams;
  const [photos, packages] = await Promise.all([
    listApprovedPhotos(),
    listPublishedPackageOptions(),
  ]);
  const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY?.trim() || null;

  // Journey chips only for journeys that have approved photos.
  const withPhotos = packages.filter((item) => photos.some((photo) => photo.packageId === item.id));
  const active = withPhotos.find((item) => item.slug === journey) ?? null;
  const shown = active ? photos.filter((photo) => photo.packageId === active.id) : photos;
  const titles = new Map(packages.map((item) => [item.id, item.title]));

  const chipClass = (on: boolean) =>
    cn(
      "inline-flex h-10 items-center rounded-full px-4 text-sm font-semibold transition-colors",
      on
        ? "bg-brand text-white"
        : "border border-line bg-white text-ink hover:border-brand hover:text-brand",
    );

  return (
    <>
      <PageBanner
        title={strings.photos.heading}
        intro={strings.photos.intro}
        image={siteImages.downSouth}
        crumbs={[{ label: strings.nav.photos }]}
      />

      <div className="mx-auto max-w-[60rem] px-4 pt-10 sm:px-6 lg:px-0">
        {withPhotos.length > 0 ? (
          <nav aria-label={strings.photos.filterLabel} className="flex flex-wrap gap-2.5">
            <Link
              href="/photos"
              aria-current={!active ? "page" : undefined}
              className={chipClass(!active)}
            >
              {strings.photos.all}
            </Link>
            {withPhotos.map((item) => (
              <Link
                key={item.id}
                href={`/photos?journey=${item.slug}`}
                aria-current={active?.id === item.id ? "page" : undefined}
                className={chipClass(active?.id === item.id)}
              >
                {item.title}
              </Link>
            ))}
          </nav>
        ) : null}

        {shown.length === 0 ? (
          <p className="mt-6 rounded-2xl border border-dashed border-line bg-white p-8 text-center text-sm text-stone">
            {strings.photos.empty}
          </p>
        ) : (
          <div className="mt-6 columns-1 gap-4 sm:columns-2 lg:columns-3">
            {shown.map((photo, index) => {
              const journeyTitle = photo.packageId ? titles.get(photo.packageId) : undefined;
              return (
                <figure
                  key={photo.id}
                  className="relative mb-4 break-inside-avoid overflow-hidden rounded-2xl shadow-[0_4px_22px_rgba(11,42,61,0.1)]"
                >
                  <Image
                    src={`/photos/${photo.id}`}
                    alt={photo.altText ?? photo.caption ?? strings.photos.heading}
                    width={600}
                    height={index % 3 === 0 ? 700 : 500}
                    sizes="(min-width: 1024px) 310px, (min-width: 640px) 50vw, 100vw"
                    className="h-auto w-full"
                  />
                  {photo.caption || journeyTitle ? (
                    <figcaption className="absolute inset-x-0 bottom-0 bg-[linear-gradient(0deg,rgba(11,42,61,0.8),rgba(11,42,61,0))] px-3.5 pt-10 pb-3.5 text-sm text-white">
                      {photo.caption}
                      {journeyTitle ? (
                        <span className="mt-0.5 block text-xs font-semibold text-amber">
                          {journeyTitle}
                        </span>
                      ) : null}
                    </figcaption>
                  ) : null}
                </figure>
              );
            })}
          </div>
        )}

        <section className="mt-12 rounded-2xl border border-line bg-white p-6 shadow-card sm:p-8">
          <h2 className="font-heading text-2xl font-semibold text-ink">
            {strings.photos.submitHeading}
          </h2>
          <p className="mt-1.5 text-sm leading-6 text-stone">{strings.photos.submitIntro}</p>
          <div className="mt-5 max-w-xl">
            <PhotoSubmissionForm siteKey={siteKey} packages={packages} />
          </div>
        </section>
      </div>

      <CtaBox
        title={strings.photos.ctaHeading}
        body={strings.photos.ctaBody}
        href="/contact"
        label={strings.site.planTrip}
      />
    </>
  );
}
