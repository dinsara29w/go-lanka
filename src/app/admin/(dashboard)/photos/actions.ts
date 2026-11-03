"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

import { writeAuditEvent } from "@/server/auth/audit";
import { requireAdminMutation } from "@/server/auth/require-admin";
import { getAdminPool } from "@/server/db/pools";
import { getRequestMetadataFromHeaders } from "@/server/security/request";

function formValue(formData: FormData, name: string): string {
  const value = formData.get(name);
  return typeof value === "string" ? value : "";
}

export async function moderatePhotoAction(formData: FormData): Promise<void> {
  const session = await requireAdminMutation(formValue(formData, "_csrf"));
  const id = formValue(formData, "id");
  const decision = formValue(formData, "decision");
  const altText = formValue(formData, "altText").trim();

  if (!id || !["approve", "reject"].includes(decision)) redirect("/admin/photos");
  if (decision === "approve" && (altText.length < 1 || altText.length > 200)) {
    redirect("/admin/photos?error=alt");
  }

  const metadata = getRequestMetadataFromHeaders(await headers());
  await getAdminPool().query(
    `UPDATE photo_submissions
     SET status = $2::photo_status,
         alt_text = CASE WHEN $2 = 'approved' THEN $3 ELSE alt_text END,
         reviewed_by = $4,
         reviewed_at = now()
     WHERE id = $1::uuid`,
    [id, decision === "approve" ? "approved" : "rejected", altText || null, session.admin.id],
  );

  await writeAuditEvent(getAdminPool(), {
    actorId: session.admin.id,
    action: decision === "approve" ? "photo.approved" : "photo.rejected",
    entityType: "photo_submission",
    entityId: id,
    ipHash: metadata.ipHash,
    userAgentHash: metadata.userAgentHash,
    metadata: {},
  });

  revalidatePath("/photos");
  revalidatePath("/admin/photos");
  redirect("/admin/photos");
}
