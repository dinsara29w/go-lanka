import "server-only";

import { getPublicPool } from "@/server/db/pools";

export type PublicReview = {
  id: string;
  authorName: string;
  country: string | null;
  rating: number;
  title: string | null;
  body: string;
  isVerified: boolean;
  createdAt: Date;
  packageTitle: string;
  packageSlug: string;
};

export type ReviewAggregate = {
  count: number;
  average: number;
};

type ReviewRow = {
  id: string;
  author_name: string;
  country: string | null;
  rating: number;
  title: string | null;
  body: string;
  is_verified: boolean;
  created_at: Date;
  package_title: string;
  package_slug: string;
};

function mapReview(row: ReviewRow): PublicReview {
  return {
    id: row.id,
    authorName: row.author_name,
    country: row.country,
    rating: row.rating,
    title: row.title,
    body: row.body,
    isVerified: row.is_verified,
    createdAt: row.created_at,
    packageTitle: row.package_title,
    packageSlug: row.package_slug,
  };
}

export async function listPublishedReviews(limit = 50): Promise<PublicReview[]> {
  const result = await getPublicPool().query<ReviewRow>(
    `SELECT r.id, r.author_name, r.country, r.rating, r.title, r.body,
            r.is_verified, r.created_at, p.title AS package_title, p.slug AS package_slug
     FROM reviews r
     JOIN packages p ON p.id = r.package_id
     WHERE r.is_published = true AND p.is_published = true
     ORDER BY r.created_at DESC
     LIMIT $1`,
    [Math.min(Math.max(limit, 1), 100)],
  );
  return result.rows.map(mapReview);
}

export async function listPublishedReviewsForPackage(
  packageId: string,
  limit = 20,
): Promise<PublicReview[]> {
  const result = await getPublicPool().query<ReviewRow>(
    `SELECT r.id, r.author_name, r.country, r.rating, r.title, r.body,
            r.is_verified, r.created_at, p.title AS package_title, p.slug AS package_slug
     FROM reviews r
     JOIN packages p ON p.id = r.package_id
     WHERE r.is_published = true AND p.is_published = true AND r.package_id = $1
     ORDER BY r.created_at DESC
     LIMIT $2`,
    [packageId, Math.min(Math.max(limit, 1), 100)],
  );
  return result.rows.map(mapReview);
}

export async function getPackageReviewAggregate(packageId: string): Promise<ReviewAggregate> {
  const result = await getPublicPool().query<{ count: string; average: string | null }>(
    `SELECT count(*)::text AS count, avg(rating)::text AS average
     FROM reviews r
     JOIN packages p ON p.id = r.package_id
     WHERE r.is_published = true AND p.is_published = true AND r.package_id = $1`,
    [packageId],
  );
  const row = result.rows[0];
  return {
    count: Number(row?.count ?? "0"),
    average: Number(row?.average ?? "0"),
  };
}
