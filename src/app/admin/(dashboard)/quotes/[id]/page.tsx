import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { Button } from "@/components/ui/button";
import { strings } from "@/content/strings";
import { formatLkr } from "@/lib/currency";
import { BOARD_LABELS, BOARD_TYPES } from "@/lib/tour-builder";
import type { GeneratedItinerary } from "@/lib/validation/tour-builder";
import type { QuoteBreakdown } from "@/server/ai/pricing";
import { requireAdmin } from "@/server/auth/require-admin";
import { getAdminPool } from "@/server/db/pools";

import { approveQuoteAction, rejectQuoteAction, saveQuoteReviewAction } from "../actions";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

type QuoteRow = {
  id: string;
  reference: string;
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
  travel_date: Date | string | null;
  message: string | null;
  admin_notes: string | null;
  final_total_lkr: string | null;
  sent_email_at: Date | null;
  sent_whatsapp_at: Date | null;
  created_at: Date;
};

type PackageOption = {
  id: string;
  title: string;
  daily_rate_lkr: string;
  tier: string;
};

type VehicleOption = {
  id: string;
  name: string;
  max_pax: number;
  is_active: boolean;
};

const statusLabels: Record<QuoteRow["status"], string> = {
  draft: strings.admin.statusDraft,
  pending_review: strings.admin.statusPendingReview,
  approved: strings.admin.statusApproved,
  rejected: strings.admin.statusRejected,
};

const inputClass =
  "mt-1.5 w-full rounded-lg border border-input bg-background px-3 py-2.5 text-sm shadow-xs outline-none transition-colors placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/30";

const dateFormatter = new Intl.DateTimeFormat("en-GB", {
  dateStyle: "medium",
  timeZone: "UTC",
});

function formatDate(value: Date | string | null): string {
  if (!value) return "Not provided";
  const date = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return "Not provided";
  return dateFormatter.format(date);
}

export default async function AdminQuotePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ saved?: string; error?: string }>;
}) {
  const session = await requireAdmin();
  const { id } = await params;
  const search = await searchParams;

  const [quoteResult, packageResult, vehicleResult] = await Promise.all([
    getAdminPool().query<QuoteRow>(`SELECT * FROM tour_quotes WHERE id = $1`, [id]),
    getAdminPool().query<PackageOption>(
      `SELECT id, title, daily_rate_lkr, tier FROM packages ORDER BY title ASC`,
    ),
    getAdminPool().query<VehicleOption>(
      `SELECT id, name, max_pax, is_active FROM vehicles ORDER BY max_pax ASC, name ASC`,
    ),
  ]);
  const quote = quoteResult.rows[0];
  if (!quote) notFound();

  const breakdown = quote.breakdown as QuoteBreakdown;
  const itinerary = quote.itinerary as GeneratedItinerary;
  const totalLkr = Number(quote.final_total_lkr ?? quote.total_lkr);

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-2">
          <Link href="/admin/quotes" className="text-sm text-muted-foreground hover:text-foreground">
            ← {strings.admin.quotes}
          </Link>
          <h1 className="font-heading text-3xl font-semibold tracking-tight">
            {quote.reference}
          </h1>
          <p className="text-sm text-muted-foreground">
            {statusLabels[quote.status]} · {formatDate(quote.created_at)}
          </p>
        </div>
        <div className="text-right">
          <p className="text-xs text-muted-foreground">{strings.admin.quoteTotal}</p>
          <p className="font-heading text-2xl font-semibold">{formatLkr(totalLkr)}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            {strings.admin.quoteSentEmail}:{" "}
            {quote.sent_email_at ? formatDate(quote.sent_email_at) : strings.admin.notSent} ·{" "}
            {strings.admin.quoteSentWhatsApp}:{" "}
            {quote.sent_whatsapp_at ? formatDate(quote.sent_whatsapp_at) : strings.admin.notSent}
          </p>
        </div>
      </div>

      {search.saved ? (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
          {search.saved === "approved"
            ? strings.admin.quoteApproved
            : search.saved === "rejected"
              ? strings.admin.quoteRejectedMessage
              : strings.admin.quoteSaved}
        </div>
      ) : null}
      {search.error ? (
        <div
          role="alert"
          className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive"
        >
          {search.error === "send"
            ? strings.admin.quoteSendFailed
            : strings.admin.quoteSendFailed}
        </div>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr] lg:items-start">
        <div className="space-y-6">
          <section className="rounded-xl border border-border bg-card p-5">
            <h2 className="font-heading text-xl font-semibold">{strings.admin.customerContact}</h2>
            <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
              <div>
                <dt className="text-xs text-muted-foreground">{strings.admin.name}</dt>
                <dd className="font-medium">{quote.name ?? "—"}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">{strings.admin.email}</dt>
                <dd className="font-medium break-all">{quote.email ?? "—"}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">{strings.admin.phone}</dt>
                <dd className="font-medium">{quote.phone ?? "—"}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">{strings.admin.country}</dt>
                <dd className="font-medium">{quote.country ?? "—"}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">{strings.admin.travelDate}</dt>
                <dd className="font-medium">{formatDate(quote.travel_date)}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">{strings.admin.message}</dt>
                <dd className="font-medium">{quote.message ?? "—"}</dd>
              </div>
            </dl>
          </section>

          <section className="rounded-xl border border-border bg-card p-5">
            <h2 className="font-heading text-xl font-semibold">{strings.admin.quoteItinerary}</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {quote.days} days · {quote.nights} nights · {quote.adults} adults,{" "}
              {quote.children} children
            </p>
            <div className="mt-4 space-y-3">
              {itinerary.days?.map((day) => (
                <article key={day.day} className="rounded-lg border border-border bg-background p-4">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <p className="text-xs font-semibold uppercase tracking-wide text-accent-foreground">
                      {strings.admin.itineraryDays} {day.day}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {day.destination_slug}
                      {day.travel_km > 0 ? ` · ${Math.round(day.travel_km)} km` : ""}
                    </p>
                  </div>
                  <h3 className="mt-1 font-medium">{day.title}</h3>
                  <p className="mt-1 text-sm leading-6 text-muted-foreground">{day.notes}</p>
                  <p className="mt-2 text-xs text-muted-foreground">
                    Overnight: {day.overnight}
                  </p>
                </article>
              ))}
            </div>
          </section>
        </div>

        <div className="space-y-6">
          <section className="rounded-xl border border-border bg-card p-5">
            <h2 className="font-heading text-xl font-semibold">{strings.admin.quotePricing}</h2>
            <dl className="mt-4 space-y-3 text-sm">
              <div className="flex justify-between gap-4">
                <dt className="text-muted-foreground">{strings.admin.quotePackage}</dt>
                <dd className="text-right font-medium">{breakdown.package.title}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-muted-foreground">{strings.admin.dailyRateLkr}</dt>
                <dd className="text-right">{formatLkr(breakdown.package.dailyRateLkr)}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-muted-foreground">{strings.admin.quoteBoard}</dt>
                <dd className="text-right">
                  {BOARD_LABELS[breakdown.package.board]} ({breakdown.package.boardPercent}%)
                </dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-muted-foreground">{strings.admin.quotePackage}</dt>
                <dd className="text-right">{formatLkr(breakdown.package.subtotalLkr)}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-muted-foreground">{strings.admin.quoteVehicle}</dt>
                <dd className="text-right">{breakdown.ride.vehicleName ?? "—"}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-muted-foreground">{strings.admin.quoteDistance}</dt>
                <dd className="text-right">{breakdown.ride.distanceKm} km</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-muted-foreground">Transport</dt>
                <dd className="text-right">{formatLkr(breakdown.ride.subtotalLkr)}</dd>
              </div>
              <div className="flex justify-between gap-4 border-t border-border pt-3 font-semibold">
                <dt>{strings.admin.quoteTotal}</dt>
                <dd className="text-right">{formatLkr(totalLkr)}</dd>
              </div>
            </dl>
            {breakdown.notes?.length ? (
              <ul className="mt-3 space-y-1 text-xs text-muted-foreground">
                {breakdown.notes.map((note) => (
                  <li key={note}>• {note}</li>
                ))}
              </ul>
            ) : null}
          </section>

          <section className="rounded-xl border border-border bg-card p-5">
            <h2 className="font-heading text-xl font-semibold">{strings.admin.reviewHeading}</h2>
            <form action={saveQuoteReviewAction} className="mt-4 space-y-4">
              <input type="hidden" name="_csrf" value={session.csrfToken} />
              <input type="hidden" name="id" value={quote.id} />

              <div>
                <label htmlFor="quote-package" className="text-sm font-medium">
                  {strings.admin.quotePackage}
                </label>
                <select
                  id="quote-package"
                  name="packageId"
                  defaultValue={quote.package_id ?? ""}
                  className={inputClass}
                  required
                >
                  <option value="">Select a package</option>
                  {packageResult.rows.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.title} ({formatLkr(Number(item.daily_rate_lkr))}/day)
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label htmlFor="quote-vehicle" className="text-sm font-medium">
                  {strings.admin.quoteVehicle}
                </label>
                <select
                  id="quote-vehicle"
                  name="vehicleId"
                  defaultValue={quote.vehicle_id ?? ""}
                  className={inputClass}
                >
                  <option value="">{strings.admin.noVehicleSelected}</option>
                  {vehicleResult.rows.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name} (up to {item.max_pax})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label htmlFor="quote-board" className="text-sm font-medium">
                  {strings.admin.quoteBoard}
                </label>
                <select
                  id="quote-board"
                  name="board"
                  defaultValue={quote.board}
                  className={inputClass}
                >
                  {BOARD_TYPES.map((board) => (
                    <option key={board} value={board}>
                      {BOARD_LABELS[board]}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label htmlFor="quote-distance" className="text-sm font-medium">
                  {strings.admin.quoteDistance}
                </label>
                <input
                  id="quote-distance"
                  name="distanceKm"
                  type="number"
                  min={0}
                  step="0.1"
                  defaultValue={Number(quote.distance_km)}
                  className={inputClass}
                />
              </div>

              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" name="selfDrive" defaultChecked={quote.self_drive} />
                {strings.admin.quoteSelfDrive}
              </label>

              <div>
                <label htmlFor="quote-final-total" className="text-sm font-medium">
                  {strings.admin.finalTotal}
                </label>
                <input
                  id="quote-final-total"
                  name="finalTotal"
                  type="number"
                  min={0}
                  step="0.01"
                  defaultValue={quote.final_total_lkr ? Number(quote.final_total_lkr) : ""}
                  className={inputClass}
                />
                <p className="mt-1 text-xs text-muted-foreground">
                  {strings.admin.finalTotalHint}
                </p>
              </div>

              <div>
                <label htmlFor="quote-admin-notes" className="text-sm font-medium">
                  {strings.admin.adminNotes}
                </label>
                <textarea
                  id="quote-admin-notes"
                  name="adminNotes"
                  rows={3}
                  defaultValue={quote.admin_notes ?? ""}
                  className={inputClass}
                />
              </div>

              <Button type="submit">{strings.admin.saveReview}</Button>
            </form>
          </section>

          <section className="rounded-xl border border-border bg-card p-5">
            <h2 className="font-heading text-xl font-semibold">
              {strings.admin.approveAndSend}
            </h2>
            <p className="mt-1 text-sm leading-6 text-muted-foreground">
              {strings.admin.quoteApprovedFootnote}
            </p>
            <form action={approveQuoteAction} className="mt-4 space-y-3">
              <input type="hidden" name="_csrf" value={session.csrfToken} />
              <input type="hidden" name="id" value={quote.id} />
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  name="sendEmail"
                  defaultChecked
                  disabled={!quote.email}
                />
                {strings.admin.sendEmail}
                {quote.email ? ` (${quote.email})` : ""}
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  name="sendWhatsApp"
                  defaultChecked={Boolean(quote.phone)}
                  disabled={!quote.phone}
                />
                {strings.admin.sendWhatsApp}
                {quote.phone ? ` (${quote.phone})` : ""}
              </label>
              <Button type="submit" className="w-full">
                {strings.admin.approveAndSend}
              </Button>
            </form>

            <form action={rejectQuoteAction} className="mt-4 border-t border-border pt-4">
              <input type="hidden" name="_csrf" value={session.csrfToken} />
              <input type="hidden" name="id" value={quote.id} />
              <input type="hidden" name="adminNotes" value={quote.admin_notes ?? ""} />
              <Button type="submit" variant="outline" className="w-full">
                {strings.admin.rejectQuote}
              </Button>
            </form>
          </section>
        </div>
      </div>
    </div>
  );
}
