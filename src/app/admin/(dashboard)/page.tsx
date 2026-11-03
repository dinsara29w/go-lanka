import Link from "next/link";

import { Button } from "@/components/ui/button";
import { strings } from "@/content/strings";
import { getAdminPool } from "@/server/db/pools";

export const dynamic = "force-dynamic";

type DashboardCounts = {
  published_packages: number;
  destinations: number;
  new_bookings: number;
  pending_photos: number;
};

export default async function AdminHomePage() {
  const result = await getAdminPool().query<DashboardCounts>(
    `SELECT
       (SELECT count(*) FROM packages WHERE is_published = true)::int AS published_packages,
       (SELECT count(*) FROM destinations)::int AS destinations,
       (SELECT count(*) FROM bookings WHERE status = 'new')::int AS new_bookings,
       (SELECT count(*) FROM photo_submissions WHERE status = 'pending')::int AS pending_photos`,
  );
  const counts = result.rows[0] ?? {
    published_packages: 0,
    destinations: 0,
    new_bookings: 0,
    pending_photos: 0,
  };

  const metrics = [
    { label: strings.admin.publishedPackages, value: counts.published_packages },
    { label: strings.admin.destinationCount, value: counts.destinations },
    { label: strings.admin.newBookings, value: counts.new_bookings },
    { label: strings.admin.pendingPhotos, value: counts.pending_photos },
  ];

  return (
    <div className="space-y-8">
      <div className="space-y-2">
        <p className="text-sm font-medium text-muted-foreground">{strings.admin.dashboard}</p>
        <h1 className="font-heading text-3xl font-semibold tracking-tight">
          {strings.admin.dashboard}
        </h1>
        <p className="max-w-2xl text-sm leading-6 text-muted-foreground">
          {strings.admin.dashboardIntro}
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {metrics.map((metric) => (
          <div key={metric.label} className="rounded-xl border border-border bg-card p-5">
            <p className="text-sm text-muted-foreground">{metric.label}</p>
            <p className="mt-2 font-heading text-3xl font-semibold">{metric.value}</p>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap gap-3">
        <Button asChild>
          <Link href="/admin/packages">{strings.admin.managePackages}</Link>
        </Button>
        <Button asChild variant="outline">
          <Link href="/admin/destinations">{strings.admin.manageDestinations}</Link>
        </Button>
        <Button asChild variant="outline">
          <Link href="/admin/settings">{strings.admin.editSettings}</Link>
        </Button>
      </div>
    </div>
  );
}
