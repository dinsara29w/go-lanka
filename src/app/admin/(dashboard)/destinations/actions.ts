"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

import type { AdminSaveState } from "@/lib/admin-types";
import { adminDestinationSchema } from "@/lib/validation/admin";
import { writeAuditEvent } from "@/server/auth/audit";
import { requireAdminMutation } from "@/server/auth/require-admin";
import { getAdminPool } from "@/server/db/pools";
import { getRequestMetadataFromHeaders } from "@/server/security/request";

function formValue(formData: FormData, name: string): string {
  const value = formData.get(name);
  return typeof value === "string" ? value : "";
}

function lines(formData: FormData, name: string): string[] {
  return formValue(formData, name)
    .split(/\r?\n/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function optionalNumber(formData: FormData, name: string): number | null {
  const value = formValue(formData, name).trim();
  if (!value) return null;
  return Number(value);
}

export async function saveDestinationAction(
  _previous: AdminSaveState,
  formData: FormData,
): Promise<AdminSaveState> {
  const session = await requireAdminMutation(formValue(formData, "_csrf"));
  const metadata = getRequestMetadataFromHeaders(await headers());

  const parsed = adminDestinationSchema.safeParse({
    id: formValue(formData, "id") || undefined,
    name: formValue(formData, "name"),
    slug: formValue(formData, "slug"),
    region: formValue(formData, "region"),
    description: formValue(formData, "description"),
    heroImage: formValue(formData, "heroImage") || null,
    heroImageAlt: formValue(formData, "heroImageAlt") || null,
    mapRegionId: formValue(formData, "mapRegionId"),
    lat: optionalNumber(formData, "lat"),
    lng: optionalNumber(formData, "lng"),
    bestSeason: formValue(formData, "bestSeason") || null,
    highlights: lines(formData, "highlights"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Please check the destination details." };
  }

  const data = parsed.data;
  let destinationId: string;

  try {
    if (data.id) {
      const updated = await getAdminPool().query<{ id: string }>(
        `UPDATE destinations
         SET name = $2, slug = $3, region = $4, description = $5,
             hero_image = $6, hero_image_alt = $7, map_region_id = $8,
             lat = $9, lng = $10, best_season = $11, highlights = $12
         WHERE id = $1
         RETURNING id`,
        [
          data.id,
          data.name,
          data.slug,
          data.region,
          data.description,
          data.heroImage,
          data.heroImageAlt,
          data.mapRegionId,
          data.lat,
          data.lng,
          data.bestSeason,
          data.highlights,
        ],
      );
      if (!updated.rows[0]) return { error: "Destination not found." };
      destinationId = data.id;
    } else {
      const inserted = await getAdminPool().query<{ id: string }>(
        `INSERT INTO destinations
           (name, slug, region, description, hero_image, hero_image_alt,
            map_region_id, lat, lng, best_season, highlights)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
         RETURNING id`,
        [
          data.name,
          data.slug,
          data.region,
          data.description,
          data.heroImage,
          data.heroImageAlt,
          data.mapRegionId,
          data.lat,
          data.lng,
          data.bestSeason,
          data.highlights,
        ],
      );
      destinationId = inserted.rows[0]?.id;
      if (!destinationId) return { error: "Destination could not be created." };
    }
  } catch (error) {
    const code = (error as { code?: string } | null)?.code;
    if (code === "23505") return { error: "That slug is already in use." };
    return { error: "Destination could not be saved." };
  }

  await writeAuditEvent(getAdminPool(), {
    actorId: session.admin.id,
    action: data.id ? "destination.updated" : "destination.created",
    entityType: "destination",
    entityId: destinationId,
    ipHash: metadata.ipHash,
    userAgentHash: metadata.userAgentHash,
    metadata: {},
  });

  revalidatePath("/packages");
  revalidatePath("/map");
  revalidatePath("/admin/destinations");
  revalidatePath(`/admin/destinations/${destinationId}`);
  redirect(`/admin/destinations/${destinationId}`);
}

export async function deleteDestinationAction(formData: FormData): Promise<void> {
  const session = await requireAdminMutation(formValue(formData, "_csrf"));
  const id = formValue(formData, "id");
  if (!id) return;

  await getAdminPool().query("DELETE FROM destinations WHERE id = $1", [id]);
  await writeAuditEvent(getAdminPool(), {
    actorId: session.admin.id,
    action: "destination.deleted",
    entityType: "destination",
    entityId: id,
    ipHash: null,
    userAgentHash: null,
    metadata: {},
  });

  revalidatePath("/packages");
  revalidatePath("/map");
  revalidatePath("/admin/destinations");
  redirect("/admin/destinations");
}
