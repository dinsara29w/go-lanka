import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { strings } from "@/content/strings";
import type { AdminDestinationData } from "@/lib/admin-types";
import { requireAdmin } from "@/server/auth/require-admin";
import { getAdminPool } from "@/server/db/pools";

import { DestinationForm } from "../destination-form";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

type DestinationRow = {
  id: string;
  name: string;
  slug: string;
  region: string;
  description: string;
  hero_image: string | null;
  hero_image_alt: string | null;
  map_region_id: string;
  lat: string | null;
  lng: string | null;
  best_season: string | null;
  highlights: string[];
};

export default async function AdminDestinationEditorPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await requireAdmin();
  const { id } = await params;
  const isNew = id === "new";
  let initial: AdminDestinationData | null = null;

  if (!isNew) {
    const result = await getAdminPool().query<DestinationRow>(
      `SELECT id, name, slug, region, description, hero_image, hero_image_alt,
              map_region_id, lat, lng, best_season, highlights
       FROM destinations WHERE id = $1`,
      [id],
    );
    const row = result.rows[0];
    if (!row) notFound();

    initial = {
      id: row.id,
      name: row.name,
      slug: row.slug,
      region: row.region,
      description: row.description,
      heroImage: row.hero_image,
      heroImageAlt: row.hero_image_alt,
      mapRegionId: row.map_region_id,
      lat: row.lat === null ? null : Number(row.lat),
      lng: row.lng === null ? null : Number(row.lng),
      bestSeason: row.best_season,
      highlights: row.highlights,
    };
  }

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <p className="text-sm font-medium text-muted-foreground">{strings.admin.destinations}</p>
        <h1 className="font-heading text-3xl font-semibold tracking-tight">
          {isNew ? strings.admin.newDestination : strings.admin.editDestination}
        </h1>
      </div>

      <div className="max-w-4xl rounded-xl border border-border bg-card p-5 sm:p-6">
        <DestinationForm csrfToken={session.csrfToken} initial={initial} />
      </div>
    </div>
  );
}
