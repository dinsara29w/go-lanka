import "server-only";

import { getPublicPool } from "@/server/db/pools";

export type ApprovedPhoto = {
  id: string;
  caption: string | null;
  altText: string | null;
  packageId: string | null;
  createdAt: Date;
};

type PhotoRow = {
  id: string;
  caption: string | null;
  alt_text: string | null;
  package_id: string | null;
  created_at: Date;
};

export async function listApprovedPhotos(
  packageId: string | null = null,
): Promise<ApprovedPhoto[]> {
  const result = await getPublicPool().query<PhotoRow>(
    `SELECT id, caption, alt_text, package_id, created_at
     FROM list_approved_photos($1::uuid)`,
    [packageId],
  );
  return result.rows.map((row) => ({
    id: row.id,
    caption: row.caption,
    altText: row.alt_text,
    packageId: row.package_id,
    createdAt: row.created_at,
  }));
}

export async function getApprovedPhotoPath(
  id: string,
): Promise<{ imagePath: string; altText: string | null; caption: string | null } | null> {
  const result = await getPublicPool().query<{
    image_path: string;
    alt_text: string | null;
    caption: string | null;
  }>(`SELECT image_path, alt_text, caption FROM get_approved_photo($1::uuid)`, [id]);
  const row = result.rows[0];
  return row ? { imagePath: row.image_path, altText: row.alt_text, caption: row.caption } : null;
}
