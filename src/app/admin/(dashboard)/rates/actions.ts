"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { VEHICLE_MODES } from "@/lib/tour-builder";

import { writeAuditEvent } from "@/server/auth/audit";
import { requireAdminMutation } from "@/server/auth/require-admin";
import { getAdminPool } from "@/server/db/pools";
import { getLogger } from "@/server/security/logger";

function formValue(formData: FormData, name: string): string {
  const value = formData.get(name);
  return typeof value === "string" ? value : "";
}

const ratesSchema = z.object({
  adminWhatsAppNumber: z.string().trim().max(40).optional(),
  economyRateLkr: z.coerce.number().min(0).max(10_000_000),
  starRateLkr: z.coerce.number().min(0).max(10_000_000),
  luxuryRateLkr: z.coerce.number().min(0).max(10_000_000),
  roomOnlyPercent: z.coerce.number().min(-100).max(100),
  halfBoardPercent: z.coerce.number().min(-100).max(100),
  fullBoardPercent: z.coerce.number().min(-100).max(100),
  childRatePercent: z.coerce.number().min(0).max(100),
});

const vehicleSchema = z
  .object({
    id: z.string().uuid().optional(),
    name: z.string().trim().min(1).max(120),
    mode: z.enum(VEHICLE_MODES),
    minPax: z.coerce.number().int().min(1).max(60),
    maxPax: z.coerce.number().int().min(1).max(60),
    perKmRateLkr: z.coerce.number().min(0).max(10_000_000),
    dailyRateLkr: z.coerce.number().min(0).max(10_000_000),
    includedKmPerDay: z.coerce.number().int().min(0).max(2000),
    isActive: z.boolean(),
  })
  .refine((value) => value.maxPax >= value.minPax, {
    message: "Maximum travellers must be at least the minimum.",
    path: ["maxPax"],
  });

export async function saveTourRatesAction(formData: FormData): Promise<void> {
  const session = await requireAdminMutation(formValue(formData, "_csrf"));
  const parsed = ratesSchema.safeParse({
    adminWhatsAppNumber: formValue(formData, "adminWhatsAppNumber"),
    economyRateLkr: formValue(formData, "economyRateLkr"),
    starRateLkr: formValue(formData, "starRateLkr"),
    luxuryRateLkr: formValue(formData, "luxuryRateLkr"),
    roomOnlyPercent: formValue(formData, "roomOnlyPercent"),
    halfBoardPercent: formValue(formData, "halfBoardPercent"),
    fullBoardPercent: formValue(formData, "fullBoardPercent"),
    childRatePercent: formValue(formData, "childRatePercent"),
  });

  if (!parsed.success) {
    redirect("/admin/rates?error=rates");
  }

  const data = parsed.data;
  await getAdminPool().query(
    `INSERT INTO tour_builder_settings
       (singleton, admin_whatsapp_number, room_only_percent, half_board_percent,
        full_board_percent, child_rate_percent, economy_rate_lkr, star_rate_lkr,
        luxury_rate_lkr)
     VALUES (true, $1, $2, $3, $4, $5, $6, $7, $8)
     ON CONFLICT (singleton) DO UPDATE
     SET admin_whatsapp_number = EXCLUDED.admin_whatsapp_number,
         economy_rate_lkr = EXCLUDED.economy_rate_lkr,
         star_rate_lkr = EXCLUDED.star_rate_lkr,
         luxury_rate_lkr = EXCLUDED.luxury_rate_lkr,
         room_only_percent = EXCLUDED.room_only_percent,
         half_board_percent = EXCLUDED.half_board_percent,
         full_board_percent = EXCLUDED.full_board_percent,
         child_rate_percent = EXCLUDED.child_rate_percent`,
    [
      data.adminWhatsAppNumber?.trim() || null,
      data.roomOnlyPercent,
      data.halfBoardPercent,
      data.fullBoardPercent,
      data.childRatePercent,
      data.economyRateLkr,
      data.starRateLkr,
      data.luxuryRateLkr,
    ],
  );

  await writeAuditEvent(getAdminPool(), {
    actorId: session.admin.id,
    action: "tour_builder_rates.updated",
    entityType: "tour_builder_settings",
    entityId: "singleton",
    ipHash: null,
    userAgentHash: null,
    metadata: {},
  });

  revalidatePath("/admin/rates");
  redirect("/admin/rates?saved=rates");
}

export async function saveVehicleAction(formData: FormData): Promise<void> {
  const session = await requireAdminMutation(formValue(formData, "_csrf"));
  const parsed = vehicleSchema.safeParse({
    id: formValue(formData, "id") || undefined,
    name: formValue(formData, "name"),
    mode: formValue(formData, "mode"),
    minPax: formValue(formData, "minPax"),
    maxPax: formValue(formData, "maxPax"),
    perKmRateLkr: formValue(formData, "perKmRateLkr"),
    dailyRateLkr: formValue(formData, "dailyRateLkr"),
    includedKmPerDay: formValue(formData, "includedKmPerDay") || "0",
    isActive: formData.get("isActive") === "on",
  });

  if (!parsed.success) {
    redirect("/admin/rates?error=vehicle");
  }

  const data = parsed.data;
  try {
    if (data.id) {
      await getAdminPool().query(
        `UPDATE vehicles
         SET name = $2, min_pax = $3, max_pax = $4,
             per_km_rate_lkr = $5, daily_rate_lkr = $6, is_active = $7,
             mode = $8, included_km_per_day = $9
         WHERE id = $1`,
        [
          data.id,
          data.name,
          data.minPax,
          data.maxPax,
          data.perKmRateLkr,
          data.dailyRateLkr,
          data.isActive,
          data.mode,
          data.includedKmPerDay,
        ],
      );
    } else {
      await getAdminPool().query(
        `INSERT INTO vehicles
           (name, min_pax, max_pax, per_km_rate_lkr, daily_rate_lkr, is_active, mode,
            included_km_per_day)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [
          data.name,
          data.minPax,
          data.maxPax,
          data.perKmRateLkr,
          data.dailyRateLkr,
          data.isActive,
          data.mode,
          data.includedKmPerDay,
        ],
      );
    }
  } catch (error) {
    getLogger().error({ err: error, event: "vehicle_save_failed" }, "vehicle_save_failed");
    redirect("/admin/rates?error=vehicle");
  }

  await writeAuditEvent(getAdminPool(), {
    actorId: session.admin.id,
    action: data.id ? "vehicle.updated" : "vehicle.created",
    entityType: "vehicle",
    entityId: data.id ?? data.name,
    ipHash: null,
    userAgentHash: null,
    metadata: {},
  });

  revalidatePath("/admin/rates");
  redirect("/admin/rates?saved=vehicle");
}

export async function deleteVehicleAction(formData: FormData): Promise<void> {
  const session = await requireAdminMutation(formValue(formData, "_csrf"));
  const id = formValue(formData, "id");
  if (!z.string().uuid().safeParse(id).success) {
    redirect("/admin/rates?error=vehicle");
  }

  await getAdminPool().query("DELETE FROM vehicles WHERE id = $1", [id]);
  await writeAuditEvent(getAdminPool(), {
    actorId: session.admin.id,
    action: "vehicle.deleted",
    entityType: "vehicle",
    entityId: id,
    ipHash: null,
    userAgentHash: null,
    metadata: {},
  });

  revalidatePath("/admin/rates");
  redirect("/admin/rates?saved=vehicle");
}
