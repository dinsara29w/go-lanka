"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";

import { strings } from "@/content/strings";
import { availabilityRangeSchema } from "@/lib/validation/availability";
import { writeAuditEvent } from "@/server/auth/audit";
import { requireAdminMutation } from "@/server/auth/require-admin";
import { getAdminPool, withTransaction } from "@/server/db/pools";
import { getRequestMetadataFromHeaders } from "@/server/security/request";

export type AvailabilityActionState = {
  ok?: boolean;
  message?: string;
  error?: string;
};

function formValue(formData: FormData, name: string): string {
  const value = formData.get(name);
  return typeof value === "string" ? value : "";
}

class CapacityError extends Error {}

export async function setAvailabilityAction(
  _previous: AvailabilityActionState,
  formData: FormData,
): Promise<AvailabilityActionState> {
  const session = await requireAdminMutation(formValue(formData, "_csrf"));
  const metadata = getRequestMetadataFromHeaders(await headers());
  const parsed = availabilityRangeSchema.safeParse({
    packageId: formValue(formData, "packageId"),
    startDate: formValue(formData, "startDate"),
    endDate: formValue(formData, "endDate"),
    capacity: Number(formValue(formData, "capacity")),
    status: formValue(formData, "status"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Please check the date range." };
  }

  try {
    await withTransaction(getAdminPool(), async (client) => {
      const conflict = await client.query<{ count: string }>(
        `SELECT count(*)::text AS count
         FROM availability
         WHERE package_id = $1::uuid
           AND date BETWEEN $2::date AND $3::date
           AND booked > $4::int`,
        [parsed.data.packageId, parsed.data.startDate, parsed.data.endDate, parsed.data.capacity],
      );
      if (Number(conflict.rows[0]?.count ?? "0") > 0) {
        throw new CapacityError();
      }

      await client.query(
        `INSERT INTO availability (package_id, date, capacity, status)
         SELECT $1::uuid, day::date, $4::int, $5::availability_status
         FROM generate_series($2::date, $3::date, interval '1 day') AS day
         ON CONFLICT (package_id, date) DO UPDATE
         SET capacity = EXCLUDED.capacity,
             status = EXCLUDED.status`,
        [
          parsed.data.packageId,
          parsed.data.startDate,
          parsed.data.endDate,
          parsed.data.capacity,
          parsed.data.status,
        ],
      );

      await writeAuditEvent(client, {
        actorId: session.admin.id,
        action: "availability.updated",
        entityType: "package",
        entityId: parsed.data.packageId,
        ipHash: metadata.ipHash,
        userAgentHash: metadata.userAgentHash,
        metadata: {
          startDate: parsed.data.startDate,
          endDate: parsed.data.endDate,
          capacity: parsed.data.capacity,
          status: parsed.data.status,
        },
      });
    });
  } catch (error) {
    if (error instanceof CapacityError) {
      return { error: "Capacity cannot be lower than the number already booked on those dates." };
    }
    return { error: "Availability could not be updated." };
  }

  revalidatePath("/packages");
  revalidatePath("/admin/availability");
  return { ok: true, message: strings.admin.availabilitySaved };
}
