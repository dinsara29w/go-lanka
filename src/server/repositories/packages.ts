import "server-only";

import { cache } from "react";

import { getPublicPool } from "@/server/db/pools";

export type GalleryImage = {
  path: string;
  alt: string;
};

export type PublicPackage = {
  id: string;
  title: string;
  slug: string;
  summary: string;
  durationDays: number;
  basePriceLkr: number;
  activities: string[];
  heroImage: string | null;
  heroImageAlt: string | null;
  featured: boolean;
};

export type PublicDestinationRef = {
  id: string;
  name: string;
  slug: string;
  region: string;
};

export type PublicItineraryDay = {
  dayNumber: number;
  title: string;
  description: string;
  destinationName: string | null;
  accommodation: string | null;
  meals: string[];
};

export type PublicPackageDetail = PublicPackage & {
  inclusions: string[];
  exclusions: string[];
  gallery: GalleryImage[];
  destinations: PublicDestinationRef[];
  itinerary: PublicItineraryDay[];
};

export type PackageFilters = {
  destination?: string;
  activity?: string;
  duration?: string;
};

type PackageRow = {
  id: string;
  title: string;
  slug: string;
  summary: string;
  duration_days: number;
  base_price_lkr: string | number;
  activities: string[];
  hero_image: string | null;
  hero_image_alt: string | null;
  featured: boolean;
};

type PackageDetailRow = PackageRow & {
  inclusions: string[];
  exclusions: string[];
  gallery: unknown;
};

function mapPackage(row: PackageRow): PublicPackage {
  return {
    id: row.id,
    title: row.title,
    slug: row.slug,
    summary: row.summary,
    durationDays: row.duration_days,
    basePriceLkr: Number(row.base_price_lkr),
    activities: row.activities,
    heroImage: row.hero_image,
    heroImageAlt: row.hero_image_alt,
    featured: row.featured,
  };
}

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

const VALID_DURATIONS = new Set(["1-3", "4-7", "8-14", "15-plus"]);

export async function listPublishedPackages(
  limit = 6,
  filters: PackageFilters = {},
): Promise<PublicPackage[]> {
  const destination = filters.destination?.trim() || null;
  const activity = filters.activity?.trim() || null;
  const duration =
    filters.duration && VALID_DURATIONS.has(filters.duration) ? filters.duration : null;

  const result = await getPublicPool().query<PackageRow>(
    `SELECT p.id, p.title, p.slug, p.summary, p.duration_days, p.base_price_lkr,
            p.activities, p.hero_image, p.hero_image_alt, p.featured
     FROM packages p
     WHERE p.is_published = true
       AND (
         $1::text IS NULL OR EXISTS (
           SELECT 1
           FROM package_destinations pd
           JOIN destinations d ON d.id = pd.destination_id
           WHERE pd.package_id = p.id AND d.slug = $1
         )
       )
       AND ($2::text IS NULL OR $2 = ANY(p.activities))
       AND (
         $3::text IS NULL
         OR ($3 = '1-3' AND p.duration_days BETWEEN 1 AND 3)
         OR ($3 = '4-7' AND p.duration_days BETWEEN 4 AND 7)
         OR ($3 = '8-14' AND p.duration_days BETWEEN 8 AND 14)
         OR ($3 = '15-plus' AND p.duration_days >= 15)
       )
     ORDER BY p.featured DESC, p.created_at DESC
     LIMIT $4`,
    [destination, activity, duration, Math.min(Math.max(limit, 1), 48)],
  );

  return result.rows.map(mapPackage);
}

export async function listFeaturedPackages(limit = 3): Promise<PublicPackage[]> {
  const result = await getPublicPool().query<PackageRow>(
    `SELECT id, title, slug, summary, duration_days, base_price_lkr, activities,
            hero_image, hero_image_alt, featured
     FROM packages
     WHERE is_published = true
     ORDER BY featured DESC, created_at DESC
     LIMIT $1`,
    [Math.min(Math.max(limit, 1), 12)],
  );

  return result.rows.map(mapPackage);
}

export async function listPublishedPackageSitemapEntries(): Promise<
  Array<{ slug: string; updatedAt: Date }>
> {
  const result = await getPublicPool().query<{ slug: string; updated_at: Date }>(
    "SELECT slug, updated_at FROM packages WHERE is_published = true ORDER BY updated_at DESC",
  );
  return result.rows.map((row) => ({ slug: row.slug, updatedAt: row.updated_at }));
}

export async function listPublishedPackageOptions(): Promise<
  Array<{ id: string; title: string; slug: string }>
> {
  const result = await getPublicPool().query<{ id: string; title: string; slug: string }>(
    "SELECT id, title, slug FROM packages WHERE is_published = true ORDER BY title ASC",
  );
  return result.rows;
}

export async function getPackageFilterOptions(): Promise<{
  destinations: PublicDestinationRef[];
  activities: string[];
}> {
  const [destinations, activities] = await Promise.all([
    getPublicPool().query<PublicDestinationRef>(
      "SELECT id, name, slug, region FROM destinations ORDER BY name ASC",
    ),
    getPublicPool().query<{ activity: string }>(
      `SELECT DISTINCT unnest(activities) AS activity
       FROM packages
       WHERE is_published = true
       ORDER BY activity ASC`,
    ),
  ]);

  return {
    destinations: destinations.rows,
    activities: activities.rows.map((row) => row.activity),
  };
}

export const getPublishedPackageBySlug = cache(async function getPublishedPackageBySlug(
  slug: string,
): Promise<PublicPackageDetail | null> {
  const result = await getPublicPool().query<PackageDetailRow>(
    `SELECT id, title, slug, summary, duration_days, base_price_lkr, activities,
            hero_image, hero_image_alt, featured, inclusions, exclusions, gallery
     FROM packages
     WHERE slug = $1 AND is_published = true
     LIMIT 1`,
    [slug],
  );
  const row = result.rows[0];
  if (!row) return null;

  const [destinationRows, itineraryRows] = await Promise.all([
    getPublicPool().query<PublicDestinationRef>(
      `SELECT d.id, d.name, d.slug, d.region
       FROM destinations d
       JOIN package_destinations pd ON pd.destination_id = d.id
       WHERE pd.package_id = $1
       ORDER BY d.name ASC`,
      [row.id],
    ),
    getPublicPool().query<{
      day_number: number;
      title: string;
      description: string;
      destination_name: string | null;
      accommodation: string | null;
      meals: string[];
    }>(
      `SELECT d.day_number, d.title, d.description, dest.name AS destination_name,
              d.accommodation, d.meals
       FROM itinerary_days d
       LEFT JOIN destinations dest ON dest.id = d.destination_id
       WHERE d.package_id = $1
       ORDER BY d.day_number ASC`,
      [row.id],
    ),
  ]);

  return {
    ...mapPackage(row),
    inclusions: row.inclusions,
    exclusions: row.exclusions,
    gallery: galleryFrom(row.gallery),
    destinations: destinationRows.rows,
    itinerary: itineraryRows.rows.map((day) => ({
      dayNumber: day.day_number,
      title: day.title,
      description: day.description,
      destinationName: day.destination_name,
      accommodation: day.accommodation,
      meals: day.meals,
    })),
  };
});
