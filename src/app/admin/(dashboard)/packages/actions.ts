"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

import type { AdminSaveState } from "@/lib/admin-types";
import { adminPackageSchema } from "@/lib/validation/admin";
import { writeAuditEvent } from "@/server/auth/audit";
import { requireAdminMutation } from "@/server/auth/require-admin";
import { getAdminPool, withTransaction } from "@/server/db/pools";
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

function parseJson(value: string): unknown {
  try {
    return JSON.parse(value || "[]");
  } catch {
    return null;
  }
}

export async function savePackageAction(
  _previous: AdminSaveState,
  formData: FormData,
): Promise<AdminSaveState> {
  const session = await requireAdminMutation(formValue(formData, "_csrf"));
  const metadata = getRequestMetadataFromHeaders(await headers());

  const input = {
    id: formValue(formData, "id") || undefined,
    title: formValue(formData, "title"),
    slug: formValue(formData, "slug"),
    summary: formValue(formData, "summary"),
    durationDays: Number(formValue(formData, "durationDays")),
    basePriceLkr: Number(formValue(formData, "basePriceLkr")),
    dailyRateLkr: Number(formValue(formData, "dailyRateLkr")),
    tier: formValue(formData, "tier"),
    activities: lines(formData, "activities"),
    inclusions: lines(formData, "inclusions"),
    exclusions: lines(formData, "exclusions"),
    isPublished: formData.get("isPublished") === "on",
    featured: formData.get("featured") === "on",
    heroImage: formValue(formData, "heroImage") || null,
    heroImageAlt: formValue(formData, "heroImageAlt") || null,
    gallery: parseJson(formValue(formData, "gallery")),
    destinationIds: formData
      .getAll("destinationIds")
      .filter((value): value is string => typeof value === "string"),
    itinerary: parseJson(formValue(formData, "itinerary")),
  };

  const parsed = adminPackageSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Please check the package details." };
  }

  const data = parsed.data;
  let packageId: string;

  try {
    packageId = await withTransaction(getAdminPool(), async (client) => {
      let id = data.id;

      if (id) {
        const updated = await client.query<{ id: string }>(
          `UPDATE packages
           SET title = $2, slug = $3, summary = $4, duration_days = $5,
               base_price_lkr = $6, activities = $7, hero_image = $8,
               hero_image_alt = $9, gallery = $10::jsonb, inclusions = $11,
               exclusions = $12, is_published = $13, featured = $14,
               daily_rate_lkr = $15, tier = $16
           WHERE id = $1
           RETURNING id`,
          [
            id,
            data.title,
            data.slug,
            data.summary,
            data.durationDays,
            data.basePriceLkr,
            data.activities,
            data.heroImage,
            data.heroImageAlt,
            JSON.stringify(data.gallery),
            data.inclusions,
            data.exclusions,
            data.isPublished,
            data.featured,
            data.dailyRateLkr,
            data.tier,
          ],
        );
        if (!updated.rows[0]) throw new Error("not_found");
      } else {
        const inserted = await client.query<{ id: string }>(
          `INSERT INTO packages
             (title, slug, summary, duration_days, base_price_lkr, activities,
              hero_image, hero_image_alt, gallery, inclusions, exclusions,
              is_published, featured, daily_rate_lkr, tier)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb, $10, $11, $12, $13, $14, $15)
           RETURNING id`,
          [
            data.title,
            data.slug,
            data.summary,
            data.durationDays,
            data.basePriceLkr,
            data.activities,
            data.heroImage,
            data.heroImageAlt,
            JSON.stringify(data.gallery),
            data.inclusions,
            data.exclusions,
            data.isPublished,
            data.featured,
            data.dailyRateLkr,
            data.tier,
          ],
        );
        id = inserted.rows[0]?.id;
        if (!id) throw new Error("insert_failed");
      }

      await client.query("DELETE FROM package_destinations WHERE package_id = $1", [id]);
      for (const destinationId of new Set(data.destinationIds)) {
        await client.query(
          "INSERT INTO package_destinations (package_id, destination_id) VALUES ($1, $2)",
          [id, destinationId],
        );
      }

      await client.query("DELETE FROM itinerary_days WHERE package_id = $1", [id]);
      for (const day of data.itinerary) {
        await client.query(
          `INSERT INTO itinerary_days
             (package_id, day_number, title, description, destination_id, accommodation, meals)
           VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          [
            id,
            day.dayNumber,
            day.title,
            day.description,
            day.destinationId,
            day.accommodation || null,
            day.meals,
          ],
        );
      }

      await writeAuditEvent(client, {
        actorId: session.admin.id,
        action: data.id ? "package.updated" : "package.created",
        entityType: "package",
        entityId: id,
        ipHash: metadata.ipHash,
        userAgentHash: metadata.userAgentHash,
        metadata: { published: data.isPublished, featured: data.featured },
      });

      return id;
    });
  } catch (error) {
    const code = (error as { code?: string } | null)?.code;
    if (code === "23505") {
      return { error: "That slug is already in use." };
    }
    return { error: "Package could not be saved. Check the fields and try again." };
  }

  revalidatePath("/packages");
  revalidatePath(`/packages/${data.slug}`);
  revalidatePath("/admin/packages");
  revalidatePath(`/admin/packages/${packageId}`);
  redirect(`/admin/packages/${packageId}`);
}

export async function deletePackageAction(formData: FormData): Promise<void> {
  const session = await requireAdminMutation(formValue(formData, "_csrf"));
  const id = formValue(formData, "id");
  if (!id) return;

  await getAdminPool().query("DELETE FROM packages WHERE id = $1", [id]);
  await writeAuditEvent(getAdminPool(), {
    actorId: session.admin.id,
    action: "package.deleted",
    entityType: "package",
    entityId: id,
    ipHash: null,
    userAgentHash: null,
    metadata: {},
  });

  revalidatePath("/packages");
  revalidatePath("/admin/packages");
  redirect("/admin/packages");
}
