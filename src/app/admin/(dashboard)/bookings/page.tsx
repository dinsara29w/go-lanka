import Link from "next/link";

import { Button } from "@/components/ui/button";
import { strings } from "@/content/strings";
import {
  BOOKING_STATUSES,
  bookingStatusClass,
  bookingStatusLabel,
  type BookingStatus,
} from "@/lib/booking";
import { requireAdmin } from "@/server/auth/require-admin";
import { getAdminPool } from "@/server/db/pools";

export const dynamic = "force-dynamic";

const dateFormatter = new Intl.DateTimeFormat("en-GB", {
  dateStyle: "medium",
  timeStyle: "short",
});

type BookingRow = {
  id: string;
  reference: string;
  name: string;
  email: string;
  travel_date: string;
  adults: number;
  children: number;
  status: BookingStatus;
  created_at: Date;
  package_title: string | null;
};

export default async function AdminBookingsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; q?: string }>;
}) {
  await requireAdmin();
  const params = await searchParams;
  const status = BOOKING_STATUSES.includes(params.status as BookingStatus)
    ? (params.status as BookingStatus)
    : null;
  const search = typeof params.q === "string" ? params.q.trim().slice(0, 200) : "";
  const searchPattern = search ? `%${search}%` : null;

  const result = await getAdminPool().query<BookingRow>(
    `SELECT b.id, b.reference, b.name, b.email, b.travel_date::text AS travel_date,
            b.adults, b.children, b.status, b.created_at, p.title AS package_title
     FROM bookings b
     LEFT JOIN packages p ON p.id = b.package_id
     WHERE ($1::text IS NULL OR b.status = $1::booking_status)
       AND (
         $2::text IS NULL
         OR b.reference ILIKE $2
         OR b.name ILIKE $2
         OR b.email ILIKE $2
       )
     ORDER BY b.created_at DESC
     LIMIT 200`,
    [status, searchPattern],
  );

  const query = new URLSearchParams();
  if (status) query.set("status", status);
  if (search) query.set("q", search);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="space-y-2">
          <p className="text-sm font-medium text-muted-foreground">{strings.admin.bookings}</p>
          <h1 className="font-heading text-3xl font-semibold tracking-tight">
            {strings.admin.bookings}
          </h1>
          <p className="max-w-2xl text-sm leading-6 text-muted-foreground">
            {strings.admin.bookingsIntro}
          </p>
        </div>
        <Button asChild variant="outline">
          <a href={`/admin/bookings/export${query.toString() ? `?${query}` : ""}`}>
            {strings.admin.exportCsv}
          </a>
        </Button>
      </div>

      <form
        method="get"
        action="/admin/bookings"
        className="flex flex-wrap items-end gap-3 rounded-xl border border-border bg-card p-4"
      >
        <div className="min-w-56 flex-1">
          <label htmlFor="booking-search" className="text-sm font-medium">
            {strings.admin.searchBookings}
          </label>
          <input
            id="booking-search"
            name="q"
            defaultValue={search}
            className="mt-1.5 w-full rounded-lg border border-input bg-background px-3 py-2.5 text-sm"
          />
        </div>
        <div>
          <label htmlFor="booking-status-filter" className="text-sm font-medium">
            {strings.admin.status}
          </label>
          <select
            id="booking-status-filter"
            name="status"
            defaultValue={status ?? ""}
            className="mt-1.5 rounded-lg border border-input bg-background px-3 py-2.5 text-sm"
          >
            <option value="">{strings.admin.allStatuses}</option>
            {BOOKING_STATUSES.map((item) => (
              <option key={item} value={item}>
                {bookingStatusLabel(item)}
              </option>
            ))}
          </select>
        </div>
        <Button type="submit" variant="outline">
          {strings.admin.filter}
        </Button>
      </form>

      {result.rows.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border bg-card p-6 text-sm text-muted-foreground">
          {strings.admin.noBookings}
        </p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border bg-card">
          <table className="w-full min-w-[900px] text-left text-sm">
            <thead className="border-b border-border bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-4 py-3 font-medium">{strings.admin.reference}</th>
                <th className="px-4 py-3 font-medium">{strings.admin.customer}</th>
                <th className="px-4 py-3 font-medium">{strings.admin.packages}</th>
                <th className="px-4 py-3 font-medium">{strings.admin.travelDate}</th>
                <th className="px-4 py-3 font-medium">{strings.admin.status}</th>
                <th className="px-4 py-3 font-medium">{strings.admin.createdAt}</th>
                <th className="px-4 py-3 font-medium" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {result.rows.map((row) => (
                <tr key={row.id}>
                  <td className="whitespace-nowrap px-4 py-3 font-mono text-xs">{row.reference}</td>
                  <td className="px-4 py-3">
                    <p className="font-medium">{row.name}</p>
                    <p className="text-xs text-muted-foreground">{row.email}</p>
                  </td>
                  <td className="px-4 py-3 text-xs">{row.package_title ?? "Custom"}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-xs">
                    {row.travel_date} · {row.adults + row.children} pax
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex rounded-full border px-2 py-0.5 text-xs ${bookingStatusClass(row.status)}`}
                    >
                      {bookingStatusLabel(row.status)}
                    </span>
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-xs text-muted-foreground">
                    {dateFormatter.format(row.created_at)}
                  </td>
                  <td className="px-4 py-3">
                    <Button asChild variant="outline" size="sm">
                      <Link href={`/admin/bookings/${row.id}`}>{strings.admin.viewBooking}</Link>
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
