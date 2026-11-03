import Link from "next/link";

import { Button } from "@/components/ui/button";
import { strings } from "@/content/strings";
import { requireAdmin } from "@/server/auth/require-admin";
import { getAdminPool } from "@/server/db/pools";
import { getAvailabilityForMonth } from "@/server/repositories/availability";

import { AvailabilityForm } from "./availability-form";

export const dynamic = "force-dynamic";

const monthFormatter = new Intl.DateTimeFormat("en", {
  month: "long",
  year: "numeric",
  timeZone: "UTC",
});

function pad(value: number): string {
  return String(value).padStart(2, "0");
}

function monthBounds(month: string) {
  const [year, monthNumber] = month.split("-").map(Number);
  const start = `${year}-${pad(monthNumber ?? 1)}-01`;
  const lastDay = new Date(Date.UTC(year ?? 2000, monthNumber ?? 1, 0)).getUTCDate();
  const end = `${year}-${pad(monthNumber ?? 1)}-${pad(lastDay)}`;
  const nextDate = new Date(Date.UTC(year ?? 2000, monthNumber ?? 1, 1));
  const nextMonth = `${nextDate.getUTCFullYear()}-${pad(nextDate.getUTCMonth() + 1)}`;
  const previousDate = new Date(Date.UTC(year ?? 2000, (monthNumber ?? 1) - 2, 1));
  const previousMonth = `${previousDate.getUTCFullYear()}-${pad(previousDate.getUTCMonth() + 1)}`;
  return {
    year: year ?? 2000,
    monthNumber: monthNumber ?? 1,
    start,
    end,
    nextMonth,
    previousMonth,
  };
}

export default async function AdminAvailabilityPage({
  searchParams,
}: {
  searchParams: Promise<{ packageId?: string; month?: string }>;
}) {
  const session = await requireAdmin();
  const params = await searchParams;

  const packagesResult = await getAdminPool().query<{ id: string; title: string }>(
    "SELECT id, title FROM packages ORDER BY title ASC",
  );
  const packages = packagesResult.rows;

  if (packages.length === 0) {
    return (
      <div className="space-y-4">
        <h1 className="font-heading text-3xl font-semibold tracking-tight">
          {strings.admin.availability}
        </h1>
        <p className="text-sm text-muted-foreground">{strings.admin.noPackagesForAvailability}</p>
        <Button asChild>
          <Link href="/admin/packages/new">{strings.admin.newPackage}</Link>
        </Button>
      </div>
    );
  }

  const currentMonthResult = await getAdminPool().query<{ month: string }>(
    "SELECT to_char(current_date, 'YYYY-MM') AS month",
  );
  const currentMonth = currentMonthResult.rows[0]?.month ?? "2026-01";
  const requestedPackage = packages.find((item) => item.id === params.packageId);
  const packageId = requestedPackage?.id ?? packages[0]!.id;
  const month = /^\d{4}-\d{2}$/.test(params.month ?? "") ? params.month! : currentMonth;
  const bounds = monthBounds(month);
  const monthDate = new Date(`${month}-01T00:00:00Z`);

  const rows = await getAvailabilityForMonth(packageId, bounds.start, bounds.nextMonth + "-01");
  const byDate = new Map(rows.map((row) => [row.date, row]));

  const firstWeekday = new Date(Date.UTC(bounds.year, bounds.monthNumber - 1, 1)).getUTCDay();
  const daysInMonth = new Date(Date.UTC(bounds.year, bounds.monthNumber, 0)).getUTCDate();
  const cells: Array<{ date: string; day: number } | null> = Array.from(
    { length: firstWeekday },
    () => null,
  );
  for (let day = 1; day <= daysInMonth; day += 1) {
    cells.push({ date: `${month}-${pad(day)}`, day });
  }
  const weekdays = Array.from({ length: 7 }, (_, index) =>
    new Intl.DateTimeFormat("en", { weekday: "short", timeZone: "UTC" }).format(
      new Date(Date.UTC(2024, 0, 7 + index)),
    ),
  );

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <p className="text-sm font-medium text-muted-foreground">{strings.admin.availability}</p>
        <h1 className="font-heading text-3xl font-semibold tracking-tight">
          {strings.admin.availability}
        </h1>
        <p className="max-w-2xl text-sm leading-6 text-muted-foreground">
          {strings.admin.availabilityIntro}
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr] lg:items-start">
        <div className="space-y-4">
          <form
            method="get"
            action="/admin/availability"
            className="flex flex-wrap items-end gap-3"
          >
            <div className="min-w-56 flex-1">
              <label htmlFor="availability-view-package" className="text-sm font-medium">
                {strings.admin.package}
              </label>
              <select
                id="availability-view-package"
                name="packageId"
                defaultValue={packageId}
                className="mt-1.5 w-full rounded-lg border border-input bg-background px-3 py-2.5 text-sm"
              >
                {packages.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.title}
                  </option>
                ))}
              </select>
            </div>
            <input type="hidden" name="month" value={month} />
            <Button type="submit" variant="outline">
              {strings.admin.month}
            </Button>
          </form>

          <div className="rounded-xl border border-border bg-card p-4">
            <div className="flex items-center justify-between gap-2">
              <Button asChild variant="outline" size="icon-sm">
                <Link
                  href={`/admin/availability?packageId=${packageId}&month=${bounds.previousMonth}`}
                  aria-label={strings.admin.previous}
                >
                  ‹
                </Link>
              </Button>
              <p className="font-medium">{monthFormatter.format(monthDate)}</p>
              <Button asChild variant="outline" size="icon-sm">
                <Link
                  href={`/admin/availability?packageId=${packageId}&month=${bounds.nextMonth}`}
                  aria-label={strings.admin.next}
                >
                  ›
                </Link>
              </Button>
            </div>

            <div className="mt-4 grid grid-cols-7 gap-1 text-center text-[11px] font-medium text-muted-foreground">
              {weekdays.map((weekday) => (
                <span key={weekday}>{weekday}</span>
              ))}
            </div>

            <div className="mt-1 grid grid-cols-7 gap-1">
              {cells.map((cell, index) => {
                if (!cell) return <span key={`empty-${index}`} />;
                const item = byDate.get(cell.date);
                return (
                  <div
                    key={cell.date}
                    className={`min-h-16 rounded-md border p-1.5 text-xs ${
                      item
                        ? item.status === "closed"
                          ? "border-destructive/30 bg-destructive/5"
                          : "border-border bg-background"
                        : "border-dashed border-border bg-muted/20"
                    }`}
                  >
                    <p className="font-medium">{cell.day}</p>
                    {item ? (
                      <>
                        <p className="text-[10px] text-muted-foreground">
                          {item.booked}/{item.capacity}
                        </p>
                        <p className="text-[10px] capitalize">{item.status}</p>
                      </>
                    ) : (
                      <p className="text-[10px] text-muted-foreground">{strings.admin.notSet}</p>
                    )}
                  </div>
                );
              })}
            </div>

            {rows.length === 0 ? (
              <p className="mt-4 text-sm text-muted-foreground">
                {strings.admin.noAvailabilityMonth}
              </p>
            ) : null}
          </div>
        </div>

        <div className="rounded-xl border border-border bg-card p-5">
          <h2 className="font-heading text-lg font-semibold">{strings.admin.bulkSet}</h2>
          <div className="mt-4">
            <AvailabilityForm
              csrfToken={session.csrfToken}
              packages={packages}
              packageId={packageId}
              defaultStart={bounds.start}
              defaultEnd={bounds.end}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
