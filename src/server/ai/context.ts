import "server-only";

import { getPublicPool } from "@/server/db/pools";

export type TourBuilderDestination = {
  name: string;
  slug: string;
  region: string;
  description: string;
  bestSeason: string | null;
  highlights: string[];
  lat: number | null;
  lng: number | null;
  heroImage: string | null;
};

export type TourBuilderPackage = {
  id: string;
  title: string;
  slug: string;
  summary: string;
  durationDays: number;
  basePriceLkr: number;
  dailyRateLkr: number;
  tier: "economy" | "star" | "luxury";
  activities: string[];
  destinationSlugs: string[];
  itinerary: Array<{
    day: number;
    title: string;
    accommodation: string | null;
    meals: string[];
  }>;
};

export type TourBuilderContext = {
  destinations: TourBuilderDestination[];
  packages: TourBuilderPackage[];
  activities: string[];
};

type DestinationRow = {
  name: string;
  slug: string;
  region: string;
  description: string;
  best_season: string | null;
  highlights: string[];
  lat: string | null;
  lng: string | null;
  hero_image: string | null;
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
};

type DestinationLinkRow = {
  package_id: string;
  destination_slug: string;
};

type ItineraryRow = {
  package_id: string;
  day_number: number;
  title: string;
  accommodation: string | null;
  meals: string[];
};

export async function getTourBuilderContext(): Promise<TourBuilderContext> {
  const pool = getPublicPool();
  const [destinationResult, packageResult] = await Promise.all([
    pool.query<DestinationRow>(
      `SELECT name, slug, region, description, best_season, highlights, lat, lng, hero_image
       FROM destinations ORDER BY name ASC LIMIT 100`,
    ),
    pool.query<PackageRow>(
      `SELECT id, title, slug, summary, duration_days, base_price_lkr,
              daily_rate_lkr, tier, activities
       FROM packages WHERE is_published = true
       ORDER BY featured DESC, duration_days ASC LIMIT 60`,
    ),
  ]);

  const packageIds = packageResult.rows.map((row) => row.id);
  const [links, itinerary] = await Promise.all([
    packageIds.length
      ? pool.query<DestinationLinkRow>(
          `SELECT pd.package_id, d.slug AS destination_slug
           FROM package_destinations pd
           JOIN destinations d ON d.id = pd.destination_id
           WHERE pd.package_id = ANY($1::uuid[])`,
          [packageIds],
        )
      : Promise.resolve({ rows: [] as DestinationLinkRow[] }),
    packageIds.length
      ? pool.query<ItineraryRow>(
          `SELECT package_id, day_number, title, accommodation, meals
           FROM itinerary_days WHERE package_id = ANY($1::uuid[])
           ORDER BY day_number ASC`,
          [packageIds],
        )
      : Promise.resolve({ rows: [] as ItineraryRow[] }),
  ]);

  const linksByPackage = new Map<string, string[]>();
  for (const link of links.rows) {
    const current = linksByPackage.get(link.package_id) ?? [];
    current.push(link.destination_slug);
    linksByPackage.set(link.package_id, current);
  }

  const itineraryByPackage = new Map<string, TourBuilderPackage["itinerary"]>();
  for (const day of itinerary.rows) {
    const current = itineraryByPackage.get(day.package_id) ?? [];
    current.push({
      day: day.day_number,
      title: day.title,
      accommodation: day.accommodation,
      meals: day.meals,
    });
    itineraryByPackage.set(day.package_id, current);
  }

  const destinations = destinationResult.rows.map((row) => ({
    name: row.name,
    slug: row.slug,
    region: row.region,
    description: row.description,
    bestSeason: row.best_season,
    highlights: row.highlights,
    lat: row.lat === null ? null : Number(row.lat),
    lng: row.lng === null ? null : Number(row.lng),
    heroImage: row.hero_image,
  }));

  const packages = packageResult.rows.map((row) => ({
    id: row.id,
    title: row.title,
    slug: row.slug,
    summary: row.summary,
    durationDays: row.duration_days,
    basePriceLkr: Number(row.base_price_lkr),
    dailyRateLkr: Number(row.daily_rate_lkr),
    tier: row.tier,
    activities: row.activities,
    destinationSlugs: linksByPackage.get(row.id) ?? [],
    itinerary: itineraryByPackage.get(row.id) ?? [],
  }));

  return {
    destinations,
    packages,
    // Activities the model may use: those on published packages plus each destination's highlights,
    // so the builder still works before any package has been published.
    activities: [
      ...new Set([
        ...packages.flatMap((item) => item.activities),
        ...destinations.flatMap((item) => item.highlights),
      ]),
    ].sort(),
  };
}
