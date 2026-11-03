import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { Button } from "@/components/ui/button";
import { strings } from "@/content/strings";
import { bookingStatusClass, bookingStatusLabel, type BookingStatus } from "@/lib/booking";
import { requireAdmin } from "@/server/auth/require-admin";
import { getAdminPool } from "@/server/db/pools";

import {
  cancelBookingAction,
  completeBookingAction,
  confirmBookingAction,
  saveBookingNotesAction,
} from "../actions";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

type BookingRow = {
  id: string;
  reference: string;
  type: "package" | "custom";
  name: string;
  email: string;
  phone: string;
  country: string;
  travel_date: string;
  adults: number;
  children: number;
  message: string | null;
  status: BookingStatus;
  currency_shown: string;
  quoted_total: string | null;
  admin_notes: string | null;
  created_at: Date;
  package_title: string | null;
  package_slug: string | null;
};

const dateFormatter = new Intl.DateTimeFormat("en-GB", {
  dateStyle: "medium",
  timeStyle: "short",
});

export default async function AdminBookingDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ updated?: string; error?: string }>;
}) {
  const session = await requireAdmin();
  const { id } = await params;
  const query = await searchParams;

  const result = await getAdminPool().query<BookingRow>(
    `SELECT b.id, b.reference, b.type, b.name, b.email, b.phone, b.country,
            b.travel_date::text AS travel_date, b.adults, b.children, b.message,
            b.status, b.currency_shown, b.quoted_total, b.admin_notes, b.created_at,
            p.title AS package_title, p.slug AS package_slug
     FROM bookings b
     LEFT JOIN packages p ON p.id = b.package_id
     WHERE b.id = $1::uuid`,
    [id],
  );
  const booking = result.rows[0];
  if (!booking) notFound();

  return (
    <div className="space-y-6">
      {query.updated ? (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
          {strings.admin.saved}
        </div>
      ) : null}
      {query.error ? (
        <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {strings.admin.bookingActionError}
        </div>
      ) : null}

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-2">
          <p className="text-sm font-medium text-muted-foreground">
            <Link href="/admin/bookings" className="hover:text-foreground">
              {strings.admin.bookings}
            </Link>{" "}
            / {booking.reference}
          </p>
          <h1 className="font-heading text-3xl font-semibold tracking-tight">
            {strings.admin.bookingDetails}
          </h1>
          <span
            className={`inline-flex rounded-full border px-3 py-1 text-xs ${bookingStatusClass(booking.status)}`}
          >
            {bookingStatusLabel(booking.status)}
          </span>
        </div>

        <div className="flex flex-wrap gap-2">
          {booking.status === "new" ? (
            <>
              <form action={confirmBookingAction}>
                <input type="hidden" name="_csrf" value={session.csrfToken} />
                <input type="hidden" name="id" value={booking.id} />
                <Button type="submit">{strings.admin.confirmBooking}</Button>
              </form>
              <form action={cancelBookingAction}>
                <input type="hidden" name="_csrf" value={session.csrfToken} />
                <input type="hidden" name="id" value={booking.id} />
                <Button type="submit" variant="destructive">
                  {strings.admin.cancelBooking}
                </Button>
              </form>
            </>
          ) : null}
          {booking.status === "confirmed" ? (
            <>
              <form action={completeBookingAction}>
                <input type="hidden" name="_csrf" value={session.csrfToken} />
                <input type="hidden" name="id" value={booking.id} />
                <Button type="submit">{strings.admin.completeBooking}</Button>
              </form>
              <form action={cancelBookingAction}>
                <input type="hidden" name="_csrf" value={session.csrfToken} />
                <input type="hidden" name="id" value={booking.id} />
                <Button type="submit" variant="destructive">
                  {strings.admin.cancelBooking}
                </Button>
              </form>
            </>
          ) : null}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr] lg:items-start">
        <div className="space-y-6">
          <section className="rounded-xl border border-border bg-card p-5">
            <h2 className="font-heading text-lg font-semibold">{strings.admin.customer}</h2>
            <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
              <div>
                <dt className="text-xs text-muted-foreground">{strings.admin.name}</dt>
                <dd className="font-medium">{booking.name}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">{strings.admin.email}</dt>
                <dd>{booking.email}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">{strings.admin.phone}</dt>
                <dd>{booking.phone}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">{strings.admin.country}</dt>
                <dd>{booking.country}</dd>
              </div>
            </dl>
            {booking.message ? (
              <div className="mt-4">
                <p className="text-xs text-muted-foreground">{strings.admin.message}</p>
                <p className="mt-1 whitespace-pre-wrap text-sm">{booking.message}</p>
              </div>
            ) : null}
          </section>

          <section className="rounded-xl border border-border bg-card p-5">
            <h2 className="font-heading text-lg font-semibold">{strings.admin.bookingDetails}</h2>
            <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
              <div>
                <dt className="text-xs text-muted-foreground">{strings.admin.reference}</dt>
                <dd className="font-mono">{booking.reference}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">{strings.admin.createdAt}</dt>
                <dd>{dateFormatter.format(booking.created_at)}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">{strings.admin.travelDate}</dt>
                <dd>{booking.travel_date}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">{strings.admin.party}</dt>
                <dd>
                  {booking.adults} adults, {booking.children} children
                </dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">{strings.admin.packages}</dt>
                <dd>
                  {booking.package_slug ? (
                    <Link
                      href={`/packages/${booking.package_slug}`}
                      className="underline underline-offset-2"
                    >
                      {booking.package_title}
                    </Link>
                  ) : (
                    "Custom itinerary"
                  )}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">{strings.admin.currency}</dt>
                <dd>{booking.currency_shown}</dd>
              </div>
            </dl>
            {booking.quoted_total ? (
              <p className="mt-4 text-sm">
                <span className="text-muted-foreground">Quoted total: </span>
                {booking.quoted_total} {booking.currency_shown}
              </p>
            ) : null}
          </section>
        </div>

        <section className="rounded-xl border border-border bg-card p-5">
          <h2 className="font-heading text-lg font-semibold">{strings.admin.adminNotes}</h2>
          <form action={saveBookingNotesAction} className="mt-4 space-y-3">
            <input type="hidden" name="_csrf" value={session.csrfToken} />
            <input type="hidden" name="id" value={booking.id} />
            <textarea
              name="adminNotes"
              rows={8}
              maxLength={5000}
              defaultValue={booking.admin_notes ?? ""}
              className="w-full rounded-lg border border-input bg-background px-3 py-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/30"
            />
            <Button type="submit" variant="outline">
              {strings.admin.saveNotes}
            </Button>
          </form>
        </section>
      </div>
    </div>
  );
}
