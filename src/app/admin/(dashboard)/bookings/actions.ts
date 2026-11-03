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

async function runStatusAction(
  formData: FormData,
  functionName: "confirm_booking" | "cancel_booking" | "complete_booking",
): Promise<void> {
  const session = await requireAdminMutation(formValue(formData, "_csrf"));
  const id = formValue(formData, "id");
  if (!id) redirect("/admin/bookings");

  const metadata = getRequestMetadataFromHeaders(await headers());
  let ok = true;

  try {
    await getAdminPool().query(`SELECT ${functionName}($1::uuid, $2::uuid, $3::text, $4::text)`, [
      id,
      session.admin.id,
      metadata.ipHash,
      metadata.userAgentHash,
    ]);
  } catch {
    ok = false;
  }

  revalidatePath("/admin/bookings");
  revalidatePath(`/admin/bookings/${id}`);
  revalidatePath("/packages");

  if (!ok) redirect(`/admin/bookings/${id}?error=1`);
  redirect(`/admin/bookings/${id}?updated=1`);
}

export async function confirmBookingAction(formData: FormData): Promise<void> {
  await runStatusAction(formData, "confirm_booking");
}

export async function cancelBookingAction(formData: FormData): Promise<void> {
  await runStatusAction(formData, "cancel_booking");
}

export async function completeBookingAction(formData: FormData): Promise<void> {
  await runStatusAction(formData, "complete_booking");
}

export async function saveBookingNotesAction(formData: FormData): Promise<void> {
  const session = await requireAdminMutation(formValue(formData, "_csrf"));
  const id = formValue(formData, "id");
  const notes = formValue(formData, "adminNotes").trim();
  if (!id) redirect("/admin/bookings");
  if (notes.length > 5000) redirect(`/admin/bookings/${id}?error=1`);

  const metadata = getRequestMetadataFromHeaders(await headers());
  await getAdminPool().query("UPDATE bookings SET admin_notes = $2 WHERE id = $1::uuid", [
    id,
    notes || null,
  ]);
  await writeAuditEvent(getAdminPool(), {
    actorId: session.admin.id,
    action: "booking.notes_updated",
    entityType: "booking",
    entityId: id,
    ipHash: metadata.ipHash,
    userAgentHash: metadata.userAgentHash,
    metadata: {},
  });

  revalidatePath(`/admin/bookings/${id}`);
  redirect(`/admin/bookings/${id}?updated=1`);
}
