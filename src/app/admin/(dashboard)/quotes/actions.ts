"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { formatLkr } from "@/lib/currency";
import { getSiteUrl } from "@/lib/site";
import { BOARD_TYPES } from "@/lib/tour-builder";
import { writeAuditEvent } from "@/server/auth/audit";
import { requireAdminMutation } from "@/server/auth/require-admin";
import { getTourBuilderContext } from "@/server/ai/context";
import { generateItineraryPdf } from "@/server/ai/pdf";
import { computeQuote, type QuoteBreakdown } from "@/server/ai/pricing";
import type { GeneratedItinerary } from "@/lib/validation/tour-builder";
import { getAdminPool } from "@/server/db/pools";
import { buildCustomerQuoteEmail } from "@/server/email/quotes";
import { sendEmail } from "@/server/email/send";
import { getServerEnv } from "@/server/env";
import { getTourBuilderRates } from "@/server/repositories/tour-builder-rates";
import { getLogger } from "@/server/security/logger";
import { generateToken, hashToken } from "@/server/security/request";
import { savePrivatePdf } from "@/server/storage/local";
import { sendWhatsApp } from "@/server/whatsapp/send";

function formValue(formData: FormData, name: string): string {
  const value = formData.get(name);
  return typeof value === "string" ? value : "";
}

type QuoteRow = {
  id: string;
  reference: string;
  ai_session_id: string | null;
  status: "draft" | "pending_review" | "approved" | "rejected";
  budget: "economy" | "star" | "luxury";
  board: "room_only" | "half_board" | "full_board";
  self_drive: boolean;
  days: number;
  nights: number;
  adults: number;
  children: number;
  travel_month: number;
  locations: string[];
  notes: string | null;
  package_id: string | null;
  package_title: string | null;
  package_slug: string | null;
  package_daily_rate_lkr: string | null;
  vehicle_id: string | null;
  vehicle_name: string | null;
  distance_km: string;
  breakdown: unknown;
  total_lkr: string;
  itinerary: unknown;
  name: string | null;
  email: string | null;
  phone: string | null;
  country: string | null;
  travel_date: string | Date | null;
  message: string | null;
  admin_notes: string | null;
  final_total_lkr: string | null;
};

type PackageRateRow = {
  id: string;
  title: string;
  slug: string;
  daily_rate_lkr: string;
  tier: "economy" | "star" | "luxury";
};

type VehicleRow = {
  id: string;
  name: string;
  min_pax: number;
  max_pax: number;
  mode: "driver" | "self_drive";
  per_km_rate_lkr: string;
  daily_rate_lkr: string;
  included_km_per_day: number;
};

async function loadQuote(id: string): Promise<QuoteRow | null> {
  const result = await getAdminPool().query<QuoteRow>(
    `SELECT id, reference, ai_session_id, status, budget, board, self_drive,
            days, nights, adults, children, travel_month, locations, notes,
            package_id, package_title, package_slug, package_daily_rate_lkr,
            vehicle_id, vehicle_name, distance_km, breakdown, total_lkr,
            itinerary, name, email, phone, country, travel_date, message,
            admin_notes, final_total_lkr
     FROM tour_quotes WHERE id = $1`,
    [id],
  );
  return result.rows[0] ?? null;
}

export async function saveQuoteReviewAction(formData: FormData): Promise<void> {
  const session = await requireAdminMutation(formValue(formData, "_csrf"));
  const id = formValue(formData, "id");
  if (!z.string().uuid().safeParse(id).success) {
    redirect("/admin/quotes?error=quote");
  }

  const parsed = z
    .object({
      packageId: z.string().uuid().optional(),
      vehicleId: z.string().uuid().optional(),
      board: z.enum(BOARD_TYPES),
      selfDrive: z.boolean(),
      distanceKm: z.coerce.number().min(0).max(5000),
      finalTotal: z.coerce.number().min(0).max(1_000_000_000).optional(),
      adminNotes: z.string().trim().max(4000).optional(),
    })
    .safeParse({
      packageId: formValue(formData, "packageId") || undefined,
      vehicleId: formValue(formData, "vehicleId") || undefined,
      board: formValue(formData, "board"),
      selfDrive: formData.get("selfDrive") === "on",
      distanceKm: formValue(formData, "distanceKm"),
      finalTotal: formValue(formData, "finalTotal") || undefined,
      adminNotes: formValue(formData, "adminNotes"),
    });

  if (!parsed.success) {
    redirect(`/admin/quotes/${id}?error=review`);
  }

  const quote = await loadQuote(id);
  if (!quote) redirect("/admin/quotes?error=quote");

  const pool = getAdminPool();
  // The package is an optional route reference; a quote can be reviewed without one.
  let packageRow: PackageRateRow | null = null;
  if (parsed.data.packageId) {
    const packageResult = await pool.query<PackageRateRow>(
      `SELECT id, title, slug, daily_rate_lkr, tier FROM packages WHERE id = $1`,
      [parsed.data.packageId],
    );
    packageRow = packageResult.rows[0] ?? null;
    if (!packageRow) redirect(`/admin/quotes/${id}?error=review`);
  }

  const vehicleResult = parsed.data.vehicleId
    ? await pool.query<VehicleRow>(
        `SELECT id, name, mode, min_pax, max_pax, per_km_rate_lkr, daily_rate_lkr,
                included_km_per_day
         FROM vehicles WHERE id = $1`,
        [parsed.data.vehicleId],
      )
    : { rows: [] as VehicleRow[] };
  const vehicleRow = vehicleResult.rows[0] ?? null;

  const rates = await getTourBuilderRates();
  const vehicle = vehicleRow
    ? {
        id: vehicleRow.id,
        name: vehicleRow.name,
        minPax: vehicleRow.min_pax,
        mode: vehicleRow.mode,
        maxPax: vehicleRow.max_pax,
        perKmRateLkr: Number(vehicleRow.per_km_rate_lkr),
        dailyRateLkr: Number(vehicleRow.daily_rate_lkr),
        includedKmPerDay: vehicleRow.included_km_per_day,
      }
    : null;
  // A chosen vehicle decides driver vs self-drive; without one, the checkbox does.
  const selfDrive = vehicle ? vehicle.mode === "self_drive" : parsed.data.selfDrive;

  const breakdown = computeQuote({
    package: packageRow
      ? { id: packageRow.id, title: packageRow.title, slug: packageRow.slug }
      : null,
    rates,
    budget: quote.budget,
    board: parsed.data.board,
    days: quote.days,
    nights: quote.nights,
    adults: quote.adults,
    children: quote.children,
    mode: selfDrive ? "self_drive" : "driver",
    distanceKm: parsed.data.distanceKm,
    vehicle,
  });

  await pool.query(
    `UPDATE tour_quotes
     SET package_id = $2, package_title = $3, package_slug = $4,
         package_daily_rate_lkr = $5, vehicle_id = $6, vehicle_name = $7,
         board = $8, self_drive = $9, distance_km = $10,
         breakdown = $11::jsonb, total_lkr = $12, final_total_lkr = $13,
         admin_notes = $14, updated_at = now()
     WHERE id = $1`,
    [
      id,
      packageRow?.id ?? null,
      packageRow?.title ?? null,
      packageRow?.slug ?? null,
      packageRow ? Number(packageRow.daily_rate_lkr) : null,
      vehicle?.id ?? null,
      vehicle?.name ?? null,
      parsed.data.board,
      selfDrive,
      parsed.data.distanceKm,
      JSON.stringify(breakdown),
      breakdown.totalLkr,
      parsed.data.finalTotal ?? null,
      parsed.data.adminNotes?.trim() || null,
    ],
  );

  await writeAuditEvent(pool, {
    actorId: session.admin.id,
    action: "tour_quote.reviewed",
    entityType: "tour_quote",
    entityId: id,
    ipHash: null,
    userAgentHash: null,
    metadata: { totalLkr: breakdown.totalLkr },
  });

  revalidatePath(`/admin/quotes/${id}`);
  revalidatePath("/admin/quotes");
  redirect(`/admin/quotes/${id}?saved=review`);
}

export async function approveQuoteAction(formData: FormData): Promise<void> {
  const session = await requireAdminMutation(formValue(formData, "_csrf"));
  const id = formValue(formData, "id");
  if (!z.string().uuid().safeParse(id).success) {
    redirect("/admin/quotes?error=quote");
  }

  const quote = await loadQuote(id);
  if (!quote) redirect("/admin/quotes?error=quote");
  if (quote.status === "draft") redirect(`/admin/quotes/${id}?error=not_submitted`);
  if (quote.status === "rejected") redirect(`/admin/quotes/${id}?error=rejected`);

  const sendByEmail = formData.get("sendEmail") === "on";
  const sendByWhatsApp = formData.get("sendWhatsApp") === "on";
  if (!sendByEmail && !sendByWhatsApp) {
    redirect(`/admin/quotes/${id}?error=channel`);
  }
  if (sendByEmail && !quote.email) {
    redirect(`/admin/quotes/${id}?error=no_email`);
  }
  if (sendByWhatsApp && !quote.phone) {
    redirect(`/admin/quotes/${id}?error=no_phone`);
  }

  const totalLkr = Number(quote.final_total_lkr ?? quote.total_lkr);
  const breakdown = quote.breakdown as QuoteBreakdown;
  const itinerary = quote.itinerary as GeneratedItinerary;
  const context = await getTourBuilderContext();
  const quiz = {
    locations: quote.locations,
    budget: quote.budget,
    board: quote.board,
    selfDrive: quote.self_drive,
    days: quote.days,
    nights: quote.nights,
    adults: quote.adults,
    children: quote.children,
    travelMonth: quote.travel_month,
    notes: quote.notes ?? undefined,
  };

  let pdfUrl: string | null = null;
  try {
    const pdf = await generateItineraryPdf({
      quiz,
      itinerary,
      breakdown,
      totalLkr,
      reference: quote.reference,
      packageTitle: quote.package_title ?? breakdown.package?.title ?? null,
      destinations: context.destinations,
      adminNotes: quote.admin_notes,
    });
    const filePath = await savePrivatePdf(pdf);
    const token = generateToken(32);
    const expiresAt = new Date(Date.now() + 30 * 86_400_000);
    await getAdminPool().query(
      `INSERT INTO tour_documents (ai_session_id, token_hash, file_path, expires_at)
       VALUES ($1, $2, $3, $4)`,
      [quote.ai_session_id, hashToken(token), filePath, expiresAt.toISOString()],
    );
    pdfUrl = `${getSiteUrl()}/tour-builder/pdf/${token}`;
  } catch (error) {
    getLogger().error({ err: error, event: "quote_pdf_failed", quoteId: id }, "quote_pdf_failed");
  }

  const env = getServerEnv();
  const deliveries: Array<{ channel: "email" | "whatsapp"; promise: Promise<void> }> = [];

  if (sendByEmail && quote.email) {
    const email = buildCustomerQuoteEmail({
      reference: quote.reference,
      name: quote.name ?? "Traveller",
      itineraryTitle: itinerary.title,
      days: quote.days,
      nights: quote.nights,
      adults: quote.adults,
      children: quote.children,
      board: quote.board,
      vehicleName: quote.vehicle_name,
      distanceKm: Number(quote.distance_km),
      totalLkr,
      breakdown,
      pdfUrl,
      adminNotes: quote.admin_notes,
    });
    deliveries.push({
      channel: "email",
      promise: sendEmail(
        {
          to: quote.email,
          subject: email.subject,
          html: email.html,
          text: email.text,
        },
        { requestId: `quote-${id}` },
      ),
    });
  }

  if (sendByWhatsApp && quote.phone) {
    deliveries.push({
      channel: "whatsapp",
      promise: sendWhatsApp(
        {
          to: quote.phone,
          text: `Your Sri Lanka quotation ${quote.reference} is ready. Total: ${formatLkr(totalLkr)}.${pdfUrl ? ` Itinerary: ${pdfUrl}` : ""}`,
          templateName: env.WHATSAPP_CUSTOMER_TEMPLATE,
          templateParams: [quote.reference, formatLkr(totalLkr), pdfUrl ?? ""],
        },
        { requestId: `quote-${id}` },
      ),
    });
  }

  const results = await Promise.allSettled(deliveries.map((item) => item.promise));
  const delivered = new Set<string>();
  results.forEach((result, index) => {
    if (result.status === "fulfilled") {
      const channel = deliveries[index]?.channel;
      if (channel) delivered.add(channel);
    }
  });

  if (delivered.size === 0) {
    getLogger().error({ event: "quote_delivery_failed", quoteId: id }, "quote_delivery_failed");
    redirect(`/admin/quotes/${id}?error=send`);
  }

  await getAdminPool().query(
    `UPDATE tour_quotes
     SET status = 'approved', reviewed_by = $2, reviewed_at = now(),
         sent_email_at = CASE WHEN $3 THEN now() ELSE sent_email_at END,
         sent_whatsapp_at = CASE WHEN $4 THEN now() ELSE sent_whatsapp_at END,
         updated_at = now()
     WHERE id = $1`,
    [id, session.admin.id, delivered.has("email"), delivered.has("whatsapp")],
  );

  await writeAuditEvent(getAdminPool(), {
    actorId: session.admin.id,
    action: "tour_quote.approved",
    entityType: "tour_quote",
    entityId: id,
    ipHash: null,
    userAgentHash: null,
    metadata: { channels: [...delivered], totalLkr },
  });

  revalidatePath(`/admin/quotes/${id}`);
  revalidatePath("/admin/quotes");
  redirect(`/admin/quotes/${id}?saved=approved`);
}

export async function rejectQuoteAction(formData: FormData): Promise<void> {
  const session = await requireAdminMutation(formValue(formData, "_csrf"));
  const id = formValue(formData, "id");
  if (!z.string().uuid().safeParse(id).success) {
    redirect("/admin/quotes?error=quote");
  }
  const adminNotes = formValue(formData, "adminNotes").trim().slice(0, 4000) || null;

  await getAdminPool().query(
    `UPDATE tour_quotes
     SET status = 'rejected', reviewed_by = $2, reviewed_at = now(),
         admin_notes = COALESCE($3, admin_notes), updated_at = now()
     WHERE id = $1`,
    [id, session.admin.id, adminNotes],
  );

  await writeAuditEvent(getAdminPool(), {
    actorId: session.admin.id,
    action: "tour_quote.rejected",
    entityType: "tour_quote",
    entityId: id,
    ipHash: null,
    userAgentHash: null,
    metadata: {},
  });

  revalidatePath("/admin/quotes");
  redirect(`/admin/quotes/${id}?saved=rejected`);
}
