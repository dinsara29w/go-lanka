import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { strings } from "@/content/strings";
import type {
  AdminDestinationOption,
  AdminItineraryDay,
  AdminPackageData,
  GalleryImage,
} from "@/lib/admin-types";
import { requireAdmin } from "@/server/auth/require-admin";
import { getAdminPool } from "@/server/db/pools";

import { PackageForm } from "../package-form";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

type PackageRow = {
  id: string;
  title: string;
  slug: string;
  summary: string;
  duration_days: number;
  base_price_lkr: string;
  daily_rate_lkr: string;
  tier: "economy" | "star" | "luxury";
  activities: string[];
  inclusions: string[];
  exclusions: string[];
  is_published: boolean;
  featured: boolean;
  hero_image: string | null;
  hero_image_alt: string | null;
  gallery: unknown;
};

type ItineraryRow = {
  day_number: number;
  title: string;
  description: string;
  destination_id: string | null;
  accommodation: string | null;
  meals: string[];
};

function galleryFrom(value: unknown): GalleryImage[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter(
      (item): item is { path: string; alt: string } =>
        typeof item === "object" &&
        item !== null &&
        typeof (item as { path?: unknown }).path === "string" &&
        typeof (item as { alt?: unknown }).alt === "string",
    )
    .map((item) => ({ path: item.path, alt: item.alt }));
}

export default async function AdminPackageEditorPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await requireAdmin();
  const { id } = await params;
  const isNew = id === "new";

  const destinationsResult = await getAdminPool().query<AdminDestinationOption>(
    `SELECT id, name, slug, region FROM destinations ORDER BY name ASC`,
  );
  const destinations = destinationsResult.rows;

  let initial: AdminPackageData | null = null;

  if (!isNew) {
    const result = await getAdminPool().query<PackageRow>(
      `SELECT id, title, slug, summary, duration_days, base_price_lkr,
              daily_rate_lkr, tier, activities,
              inclusions, exclusions, is_published, featured, hero_image,
              hero_image_alt, gallery
       FROM packages WHERE id = $1`,
      [id],
    );
    const row = result.rows[0];
    if (!row) notFound();

    const [destinationLinks, itinerary] = await Promise.all([
      getAdminPool().query<{ destination_id: string }>(
        "SELECT destination_id FROM package_destinations WHERE package_id = $1",
        [id],
      ),
      getAdminPool().query<ItineraryRow>(
        `SELECT day_number, title, description, destination_id, accommodation, meals
         FROM itinerary_days WHERE package_id = $1 ORDER BY day_number ASC`,
        [id],
      ),
    ]);

    initial = {
      id: row.id,
      title: row.title,
      slug: row.slug,
      summary: row.summary,
      durationDays: row.duration_days,
      basePriceLkr: Number(row.base_price_lkr),
      dailyRateLkr: Number(row.daily_rate_lkr),
      tier: row.tier,
      activities: row.activities,
      inclusions: row.inclusions,
      exclusions: row.exclusions,
      isPublished: row.is_published,
      featured: row.featured,
      heroImage: row.hero_image,
      heroImageAlt: row.hero_image_alt,
      gallery: galleryFrom(row.gallery),
      destinationIds: destinationLinks.rows.map((link) => link.destination_id),
      itinerary: itinerary.rows.map((day): AdminItineraryDay => ({
        dayNumber: day.day_number,
        title: day.title,
        description: day.description,
        destinationId: day.destination_id,
        accommodation: day.accommodation ?? "",
        meals: day.meals,
      })),
    };
  }

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <p className="text-sm font-medium text-muted-foreground">{strings.admin.packages}</p>
        <h1 className="font-heading text-3xl font-semibold tracking-tight">
          {isNew ? strings.admin.newPackage : strings.admin.editPackage}
        </h1>
      </div>

      <div className="max-w-5xl rounded-xl border border-border bg-card p-5 sm:p-6">
        <PackageForm csrfToken={session.csrfToken} destinations={destinations} initial={initial} />
      </div>
    </div>
  );
}
