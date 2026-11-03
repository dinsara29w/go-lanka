import { NextResponse } from "next/server";

import { BOOKING_STATUSES, type BookingStatus } from "@/lib/booking";
import { csvCell } from "@/lib/csv";
import { requireAdminApi } from "@/server/auth/require-admin";
import { getAdminPool } from "@/server/db/pools";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type ExportRow = {
  reference: string;
  status: string;
  type: string;
  name: string;
  email: string;
  phone: string;
  country: string;
  travel_date: string;
  adults: number;
  children: number;
  package_title: string | null;
  currency_shown: string;
  quoted_total: string | null;
  created_at: Date;
};

export async function GET(request: Request) {
  try {
    await requireAdminApi();
  } catch {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const url = new URL(request.url);
  const statusParam = url.searchParams.get("status");
  const status = BOOKING_STATUSES.includes(statusParam as BookingStatus)
    ? (statusParam as BookingStatus)
    : null;
  const search = url.searchParams.get("q")?.trim().slice(0, 200) ?? "";
  const searchPattern = search ? `%${search}%` : null;

  const result = await getAdminPool().query<ExportRow>(
    `SELECT b.reference, b.status, b.type, b.name, b.email, b.phone, b.country,
            b.travel_date::text AS travel_date, b.adults, b.children,
            p.title AS package_title, b.currency_shown, b.quoted_total, b.created_at
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
     LIMIT 5000`,
    [status, searchPattern],
  );

  const header = [
    "Reference",
    "Status",
    "Type",
    "Name",
    "Email",
    "Phone",
    "Country",
    "Travel date",
    "Adults",
    "Children",
    "Package",
    "Currency",
    "Quoted total",
    "Created",
  ];

  const lines = [
    header.map(csvCell).join(","),
    ...result.rows.map((row) =>
      [
        row.reference,
        row.status,
        row.type,
        row.name,
        row.email,
        row.phone,
        row.country,
        row.travel_date,
        row.adults,
        row.children,
        row.package_title ?? "Custom",
        row.currency_shown,
        row.quoted_total,
        row.created_at.toISOString(),
      ]
        .map(csvCell)
        .join(","),
    ),
  ];

  return new NextResponse(lines.join("\r\n"), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="bookings-${new Date().toISOString().slice(0, 10)}.csv"`,
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
