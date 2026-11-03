import "server-only";

import { getPublicPool } from "@/server/db/pools";

export type MapPackageLink = {
  id: string;
  title: string;
  slug: string;
};

export type MapDestination = {
  id: string;
  name: string;
  slug: string;
  region: string;
  description: string;
  heroImage: string | null;
  heroImageAlt: string | null;
  mapRegionId: string;
  bestSeason: string | null;
  highlights: string[];
  packages: MapPackageLink[];
};

type MapRow = {
  id: string;
  name: string;
  slug: string;
  region: string;
  description: string;
  hero_image: string | null;
  hero_image_alt: string | null;
  map_region_id: string;
  best_season: string | null;
  highlights: string[];
  package_id: string | null;
  package_title: string | null;
  package_slug: string | null;
};

export async function listMapDestinations(): Promise<MapDestination[]> {
  const result = await getPublicPool().query<MapRow>(
    `SELECT d.id, d.name, d.slug, d.region, d.description, d.hero_image,
            d.hero_image_alt, d.map_region_id, d.best_season, d.highlights,
            p.id AS package_id, p.title AS package_title, p.slug AS package_slug
     FROM destinations d
     LEFT JOIN package_destinations pd ON pd.destination_id = d.id
     LEFT JOIN packages p ON p.id = pd.package_id AND p.is_published = true
     ORDER BY d.name ASC, p.title ASC`,
  );

  const byId = new Map<string, MapDestination>();
  for (const row of result.rows) {
    let destination = byId.get(row.id);
    if (!destination) {
      destination = {
        id: row.id,
        name: row.name,
        slug: row.slug,
        region: row.region,
        description: row.description,
        heroImage: row.hero_image,
        heroImageAlt: row.hero_image_alt,
        mapRegionId: row.map_region_id,
        bestSeason: row.best_season,
        highlights: row.highlights,
        packages: [],
      };
      byId.set(row.id, destination);
    }
    if (row.package_id && row.package_title && row.package_slug) {
      destination.packages.push({
        id: row.package_id,
        title: row.package_title,
        slug: row.package_slug,
      });
    }
  }

  return [...byId.values()];
}
