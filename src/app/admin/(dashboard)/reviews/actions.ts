"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

import { reviewSchema } from "@/lib/validation/review";
import { writeAuditEvent } from "@/server/auth/audit";
import { requireAdminMutation } from "@/server/auth/require-admin";
import { getAdminPool } from "@/server/db/pools";
import { getRequestMetadataFromHeaders } from "@/server/security/request";

export type ReviewActionState = {
  error?: string;
};

function formValue(formData: FormData, name: string): string {
  const value = formData.get(name);
  return typeof value === "string" ? value : "";
}

export async function saveReviewAction(
  _previous: ReviewActionState,
  formData: FormData,
): Promise<ReviewActionState> {
  const session = await requireAdminMutation(formValue(formData, "_csrf"));
  const metadata = getRequestMetadataFromHeaders(await headers());
  const parsed = reviewSchema.safeParse({
    id: formValue(formData, "id") || undefined,
    packageId: formValue(formData, "packageId"),
    authorName: formValue(formData, "authorName"),
    country: formValue(formData, "country"),
    rating: Number(formValue(formData, "rating")),
    title: formValue(formData, "title"),
    body: formValue(formData, "body"),
    isVerified: formData.get("isVerified") === "on",
    isPublished: formData.get("isPublished") === "on",
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Please check the review." };
  }

  const data = parsed.data;
  let reviewId: string;

  try {
    if (data.id) {
      const updated = await getAdminPool().query<{ id: string }>(
        `UPDATE reviews
         SET package_id = $2, author_name = $3, country = $4, rating = $5,
             title = $6, body = $7, is_verified = $8, is_published = $9
         WHERE id = $1
         RETURNING id`,
        [
          data.id,
          data.packageId,
          data.authorName,
          data.country || null,
          data.rating,
          data.title || null,
          data.body,
          data.isVerified,
          data.isPublished,
        ],
      );
      if (!updated.rows[0]) return { error: "Review not found." };
      reviewId = data.id;
    } else {
      const inserted = await getAdminPool().query<{ id: string }>(
        `INSERT INTO reviews
           (package_id, author_name, country, rating, title, body, is_verified, is_published)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         RETURNING id`,
        [
          data.packageId,
          data.authorName,
          data.country || null,
          data.rating,
          data.title || null,
          data.body,
          data.isVerified,
          data.isPublished,
        ],
      );
      reviewId = inserted.rows[0]?.id;
      if (!reviewId) return { error: "Review could not be created." };
    }
  } catch {
    return { error: "Review could not be saved." };
  }

  await writeAuditEvent(getAdminPool(), {
    actorId: session.admin.id,
    action: data.id ? "review.updated" : "review.created",
    entityType: "review",
    entityId: reviewId,
    ipHash: metadata.ipHash,
    userAgentHash: metadata.userAgentHash,
    metadata: { published: data.isPublished, verified: data.isVerified },
  });

  revalidatePath("/reviews");
  revalidatePath("/packages");
  revalidatePath("/admin/reviews");
  redirect("/admin/reviews");
}

export async function deleteReviewAction(formData: FormData): Promise<void> {
  const session = await requireAdminMutation(formValue(formData, "_csrf"));
  const id = formValue(formData, "id");
  if (!id) return;

  await getAdminPool().query("DELETE FROM reviews WHERE id = $1::uuid", [id]);
  await writeAuditEvent(getAdminPool(), {
    actorId: session.admin.id,
    action: "review.deleted",
    entityType: "review",
    entityId: id,
    ipHash: null,
    userAgentHash: null,
    metadata: {},
  });

  revalidatePath("/reviews");
  revalidatePath("/packages");
  revalidatePath("/admin/reviews");
  redirect("/admin/reviews");
}
