import type { Metadata } from "next";
import Image from "next/image";

import { PhotoSubmissionForm } from "@/components/photos/photo-submission-form";
import { strings } from "@/content/strings";
import { listApprovedPhotos } from "@/server/repositories/photos";
import { listPublishedPackageOptions } from "@/server/repositories/packages";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Traveller photos",
  description: "Approved photos from travellers exploring Sri Lanka.",
  alternates: { canonical: "/photos" },
};

export default async function PhotosPage() {
  const [photos, packages] = await Promise.all([
    listApprovedPhotos(),
    listPublishedPackageOptions(),
  ]);
  const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY?.trim() || null;

  return (
    <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-20">
      <div className="max-w-2xl space-y-4">
        <p className="text-sm font-medium text-muted-foreground">{strings.nav.photos}</p>
        <h1 className="font-heading text-4xl font-semibold tracking-tight sm:text-5xl">
          {strings.photos.heading}
        </h1>
        <p className="text-base leading-7 text-muted-foreground">{strings.photos.intro}</p>
      </div>

      <div className="mt-10 grid gap-8 lg:grid-cols-[1.2fr_0.8fr] lg:items-start">
        <section>
          {photos.length === 0 ? (
            <p className="rounded-2xl border border-dashed border-border bg-muted/30 p-8 text-sm text-muted-foreground">
              {strings.photos.empty}
            </p>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2">
              {photos.map((photo) => (
                <figure
                  key={photo.id}
                  className="overflow-hidden rounded-2xl border border-border bg-card"
                >
                  <Image
                    src={`/photos/${photo.id}`}
                    alt={photo.altText ?? photo.caption ?? "Traveller photo"}
                    width={600}
                    height={450}
                    sizes="(min-width: 640px) 50vw, 100vw"
                    className="h-56 w-full object-cover"
                  />
                  {photo.caption ? (
                    <figcaption className="p-4 text-sm leading-6 text-muted-foreground">
                      {photo.caption}
                    </figcaption>
                  ) : null}
                </figure>
              ))}
            </div>
          )}
        </section>

        <aside className="rounded-2xl border border-border bg-card p-5 sm:p-6">
          <div className="space-y-2">
            <h2 className="font-heading text-2xl font-semibold tracking-tight">
              {strings.photos.submitHeading}
            </h2>
            <p className="text-sm leading-6 text-muted-foreground">{strings.photos.submitIntro}</p>
          </div>
          <div className="mt-5">
            <PhotoSubmissionForm siteKey={siteKey} packages={packages} />
          </div>
        </aside>
      </div>
    </div>
  );
}
