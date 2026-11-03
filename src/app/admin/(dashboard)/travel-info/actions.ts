"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

import { travelInfoSchema } from "@/lib/validation/travel-info";
import { writeAuditEvent } from "@/server/auth/audit";
import { requireAdminMutation } from "@/server/auth/require-admin";
import { getAdminPool } from "@/server/db/pools";
import { getRequestMetadataFromHeaders } from "@/server/security/request";

export type TravelActionState = {
  error?: string;
};

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

function parseFaqs(value: string): unknown {
  try {
    return JSON.parse(value || "[]");
  } catch {
    return null;
  }
}

export async function saveTravelInfoAction(
  _previous: TravelActionState,
  formData: FormData,
): Promise<TravelActionState> {
  const session = await requireAdminMutation(formValue(formData, "_csrf"));
  const metadata = getRequestMetadataFromHeaders(await headers());
  const parsed = travelInfoSchema.safeParse({
    id: formValue(formData, "id") || undefined,
    slug: formValue(formData, "slug"),
    title: formValue(formData, "title"),
    summary: formValue(formData, "summary"),
    body: formValue(formData, "body"),
    bullets: lines(formData, "bullets"),
    faqs: parseFaqs(formValue(formData, "faqs")),
    sortOrder: Number(formValue(formData, "sortOrder")),
    isPublished: formData.get("isPublished") === "on",
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Please check the section." };
  }

  const data = parsed.data;
  let sectionId: string;
  try {
    if (data.id) {
      const updated = await getAdminPool().query<{ id: string }>(
        `UPDATE travel_info_sections
         SET slug = $2, title = $3, summary = $4,
             content = jsonb_build_object('body', $5::text, 'bullets', $6::jsonb),
             faqs = $7::jsonb, sort_order = $8, is_published = $9
         WHERE id = $1
         RETURNING id`,
        [
          data.id,
          data.slug,
          data.title,
          data.summary || null,
          data.body,
          JSON.stringify(data.bullets),
          JSON.stringify(data.faqs),
          data.sortOrder,
          data.isPublished,
        ],
      );
      if (!updated.rows[0]) return { error: "Section not found." };
      sectionId = data.id;
    } else {
      const inserted = await getAdminPool().query<{ id: string }>(
        `INSERT INTO travel_info_sections
           (slug, title, summary, content, faqs, sort_order, is_published)
         VALUES ($1, $2, $3, jsonb_build_object('body', $4::text, 'bullets', $5::jsonb),
                 $6::jsonb, $7, $8)
         RETURNING id`,
        [
          data.slug,
          data.title,
          data.summary || null,
          data.body,
          JSON.stringify(data.bullets),
          JSON.stringify(data.faqs),
          data.sortOrder,
          data.isPublished,
        ],
      );
      sectionId = inserted.rows[0]?.id;
      if (!sectionId) return { error: "Section could not be created." };
    }
  } catch (error) {
    const code = (error as { code?: string } | null)?.code;
    if (code === "23505") return { error: "That slug is already in use." };
    return { error: "Travel information could not be saved." };
  }

  await writeAuditEvent(getAdminPool(), {
    actorId: session.admin.id,
    action: data.id ? "travel_info.updated" : "travel_info.created",
    entityType: "travel_info_section",
    entityId: sectionId,
    ipHash: metadata.ipHash,
    userAgentHash: metadata.userAgentHash,
    metadata: { published: data.isPublished },
  });

  revalidatePath("/travel-info");
  revalidatePath("/admin/travel-info");
  redirect("/admin/travel-info");
}

export async function deleteTravelInfoAction(formData: FormData): Promise<void> {
  const session = await requireAdminMutation(formValue(formData, "_csrf"));
  const id = formValue(formData, "id");
  if (!id) return;

  await getAdminPool().query("DELETE FROM travel_info_sections WHERE id = $1::uuid", [id]);
  await writeAuditEvent(getAdminPool(), {
    actorId: session.admin.id,
    action: "travel_info.deleted",
    entityType: "travel_info_section",
    entityId: id,
    ipHash: null,
    userAgentHash: null,
    metadata: {},
  });
  revalidatePath("/travel-info");
  revalidatePath("/admin/travel-info");
  redirect("/admin/travel-info");
}
